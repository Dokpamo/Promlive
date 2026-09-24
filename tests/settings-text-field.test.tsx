// @vitest-environment jsdom
import {act, useRef, useState, type ReactNode, type CSSProperties} from 'react';
import {Keyboard, TextInput} from 'react-native';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {SettingsTextEditorHost, SettingsTextField, useTextEditorCovered} from '../src/features/settings/SettingsTextField';

const keyboard = vi.hoisted(() => ({height: 0}));
const closing = vi.hoisted(() => ({defer: false, finishes: [] as (() => void)[]}));
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native, useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
    AccessibilityInfo: {isReduceMotionEnabled: async () => true, addEventListener: () => ({remove() {}})},
  };
});
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 24, left: 0})}));
vi.mock('../src/layout/KeyboardMotion', () => ({
  useKeyboardFrame: () => keyboard,
  KeyboardDock: ({children}: {children: ReactNode}) => <div>{children}</div>,
  KeyboardMotionProvider: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));
vi.mock('../src/features/appearance/AppAppearance', async () => {
  const {lightChatColors: colors} = await import('../src/features/chat/chatAppearance');
  return {useAppearance: () => ({colors, isDark: false, settings: {sheet: '#fff', surface: '#fff', selected: '#eee', divider: '#ddd', text: '#222', faint: '#aaa'}})};
});
// Retain the real field/editor and focus lifecycle; control only exit completion.
vi.mock('../src/layout/SwipeBackModal', () => ({
  SwipeBackBoundary: ({children, style}: {children: ReactNode; style?: CSSProperties}) => <div style={style}>{children}</div>,
  SwipeBackModal: ({children, onDismissStart, onClose}: {children: (close: () => void, motion: object) => ReactNode; onDismissStart: () => void; onClose: () => void}) => <div>{children(() => {
    onDismissStart();
    if (closing.defer) closing.finishes.push(onClose); else onClose();
  }, {})}</div>,
}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
const changes = vi.fn();
function Form() {
  const [key, setKey] = useState('test-secret-value');
  const [prompt, setPrompt] = useState('첫 줄\n둘째 줄\n셋째 줄\n넷째 줄');
  return <SettingsTextEditorHost>
    <SettingsTextField label="API 키" testID="key" secret value={key} onChange={value => {setKey(value); changes(value);}} placeholder="API 키를 입력해 주세요"/>
    <SettingsTextField label="프롬프트" testID="prompt" multiline value={prompt} onChange={setPrompt} placeholder="내용 입력"/>
  </SettingsTextEditorHost>;
}
async function render() {
  if (!root) {const container = document.createElement('div'); document.body.append(container); root = createRoot(container);}
  await act(async () => root!.render(<Form/>));
}
async function press(label: string) {await act(async () => (document.querySelector(`[aria-label="${label}"]`) as HTMLElement).click());}
async function enter(value: string) {
  const input = document.querySelector('input, textarea') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; keyboard.height = 0; closing.defer = false; closing.finishes = []; changes.mockClear(); vi.restoreAllMocks(); document.body.replaceChildren();
});

it('keeps saved secrets out of the preview and reveals them only inside the focused editor', async () => {
  await render();
  expect(document.querySelector('input, textarea')).toBeNull();
  expect(document.body.innerHTML).not.toContain('test-secret-value');
  await press('API 키');
  const input = document.querySelector('input')!;
  expect(input.type).toBe('text');
  expect(input.value).toBe('test-secret-value');
  expect(document.activeElement).toBe(input);
  const popup = document.querySelector('[data-testid="settings-text-editor"]')!;
  expect(popup.querySelector('[role="heading"]')).toBeNull();
  expect(popup.textContent).not.toMatch(/API 키|보기|숨김/);
  expect(popup.querySelector('[aria-label="입력 완료"]')).not.toBeNull();
  expect(changes).not.toHaveBeenCalled();
});

it('updates immediately and masks the saved preview after confirming with the check button', async () => {
  await render(); await press('API 키');
  await enter('new-test-key');
  expect(changes).toHaveBeenLastCalledWith('new-test-key');
  await press('입력 완료');
  expect(document.querySelector('input')).toBeNull();
  expect(document.body.innerHTML).not.toContain('new-test-key');
  await press('API 키');
  expect(document.querySelector('input')?.value).toBe('new-test-key');
  expect(document.querySelector('input')?.type).toBe('text');
  expect(changes).toHaveBeenCalledTimes(1);
});

it('accepts empty values without restoring stale text or requiring a save button', async () => {
  await render(); await press('API 키'); await enter('');
  await press('입력창 닫기');
  expect(changes).toHaveBeenLastCalledWith('');
  await press('API 키');
  expect(document.querySelector('input')?.value).toBe('');
  expect(document.body.textContent).not.toMatch(/저장|적용/);
});

it('does not let an old dismissal close a newly opened field', async () => {
  closing.defer = true;
  await render(); await press('API 키'); await press('입력창 닫기');
  await press('프롬프트');
  const editor = document.querySelector('textarea')!;
  expect(editor.value).toContain('넷째 줄');
  await act(async () => closing.finishes[0]!());
  expect(document.querySelector('textarea')).toBe(editor);
  expect(document.activeElement).toBe(editor);
});

it('keeps the full-screen editor fixed while its text viewport follows the keyboard', async () => {
  await render(); await press('프롬프트');
  const surface = document.querySelector<HTMLElement>('[data-testid="settings-text-editor"]')!;
  const editor = document.querySelector('textarea')!;
  const viewport = document.querySelector<HTMLElement>('[data-testid="settings-text-editor-viewport"]')!;
  const full = parseFloat(viewport.style.height);
  expect([surface.style.top, surface.style.left, surface.style.width, surface.style.height]).toEqual(['0px', '0px', '412px', '892px']);
  expect(document.querySelector('[data-testid="settings-text-editor-handle"]')).toBeNull();
  expect(document.querySelector('[data-testid="settings-text-editor-footer"]')!.contains(document.querySelector('[aria-label="입력 완료"]'))).toBe(true);
  keyboard.height = 336; await render();
  expect(parseFloat(viewport.style.height)).toBeLessThan(full - 250);
  expect(surface.style.height).toBe('892px');
  keyboard.height = 0; await render();
  expect(parseFloat(viewport.style.height)).toBe(full);
  expect(document.querySelector('textarea')).toBe(editor);
  expect(document.activeElement).toBe(editor);
  await press('입력 완료');
  expect(document.querySelector('textarea')).toBeNull();
});

it('leaves the underlying persona editor mounted and returns focus without dismissing its keyboard', async () => {
  function Covered() {return <span data-testid="covered" data-covered={useTextEditorCovered()}/>;}
  function MiniEditor() {
    const name = useRef<TextInput>(null);
    return <SettingsTextEditorHost resumeInput={name}>
      <TextInput ref={name} testID="parent-name" value="여행자"/>
      <Covered/>
      <SettingsTextField label="설명" value="기존 내용" onChange={() => {}} placeholder="설명" multiline/>
    </SettingsTextEditorHost>;
  }
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<MiniEditor/>));
  const name = document.querySelector<HTMLInputElement>('[data-testid="parent-name"]')!;
  const dismissKeyboard = vi.spyOn(Keyboard, 'dismiss');
  await press('설명');
  expect(document.querySelector('[data-testid="parent-name"]')).toBe(name);
  expect(document.querySelector('[data-testid="covered"]')?.getAttribute('data-covered')).toBe('true');
  await press('입력창 닫기');
  expect(document.querySelector('[data-testid="parent-name"]')).toBe(name);
  expect(document.querySelector('[data-testid="covered"]')?.getAttribute('data-covered')).toBe('false');
  expect(document.activeElement).toBe(name);
  expect(dismissKeyboard).not.toHaveBeenCalled();
});
