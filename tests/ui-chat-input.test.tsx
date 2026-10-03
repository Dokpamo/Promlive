// @vitest-environment jsdom
import {act, useLayoutEffect, type ComponentProps, type ReactNode} from 'react';
import {Animated} from 'react-native';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {ChatInput} from '../src/ui/chat-input/ChatInput';
import type {InputFieldProps} from '../src/ui/chat-input/InputField.types';
import type {GalleryImage} from '../src/ui/cardDetails';
import {DesktopPane} from '../src/ui/desktop/DesktopPane';

const measured = vi.hoisted(() => ({height: 25, line: undefined as number | undefined, props: null as InputFieldProps | null}));
vi.mock('react-native', async () => {
  const native = await vi.importActual<typeof import('react-native')>('react-native-web');
  return {...native, useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
    AccessibilityInfo: {isReduceMotionEnabled: async () => true, addEventListener: () => ({remove() {}})}};
});
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 24, right: 0, bottom: 34, left: 0})}));
vi.mock('../src/ui/chat-input/KeyboardDock', () => ({ChatKeyboardDock: ({children}: {children: ReactNode}) => <div>{children}</div>}));
vi.mock('../src/ui/chat-input/InputField', () => ({InputField: (p: InputFieldProps) => {
  measured.props = p;
  useLayoutEffect(() => p.onMeasure(measured.height, measured.line), [p.onMeasure, p.value, measured.height, measured.line]);
  return <textarea data-testid="ui-chat-input" value={p.value} onChange={e => p.onChange(e.target.value)} onFocus={p.onFocus} onBlur={p.onBlur}/>;
}}));
vi.mock('../src/ui/PreviewArtwork', () => ({PreviewArtwork: () => <span>첨부 미리보기</span>}));
(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
const send = vi.fn(), attach = vi.fn(), removeImage = vi.fn(), focus = vi.fn(), change = vi.fn();
const blocker = {current: null};
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`[data-testid="${id}"]`)!;
async function render(value = '', image: GalleryImage | null = null, extra: Partial<ComponentProps<typeof ChatInput>> = {}, desktop = false) {
  if (!root) {const container = document.createElement('div'); document.body.append(container); root = createRoot(container);}
  const composer = <ChatInput value={value} image={image} blocker={blocker} onChange={change} onSend={send}
    onAttach={attach} onRemoveImage={removeImage} onFocus={focus} onHeight={() => {}} {...extra}/>;
  await act(async () => root!.render(desktop ? <DesktopPane width={700} height={800}>{composer}</DesktopPane> : composer));
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; measured.height = 25; measured.line = undefined; measured.props = null; vi.clearAllMocks(); document.body.replaceChildren();
});

it('starts with text above both controls and keeps the same layout when focused or blurred', async () => {
  await render('', null, {translateY: Animated.multiply(new Animated.Value(1), new Animated.Value(60))});
  const bar = element('ui-chat-composer'), input = element<HTMLTextAreaElement>('ui-chat-input');
  const initial = bar.style.cssText;
  expect(parseFloat(bar.style.height)).toBe(106);
  expect(parseFloat(element('ui-chat-input-area').style.top)).toBe(14);
  expect(element('ui-chat-send').getAttribute('aria-disabled')).toBe('true');
  expect(element('ui-chat-composer-visibility').style.transform).toContain('translateY(60px)');
  await act(async () => {input.focus();});
  expect(focus).toHaveBeenCalledOnce();
  expect(bar.style.cssText).toBe(initial);
  expect(element('ui-chat-composer-visibility').style.transform).toContain('translateY(0px)');
  await act(async () => input.blur());
  expect(bar.style.cssText).toBe(initial);
  expect(element('ui-chat-composer-visibility').style.transform).toContain('translateY(60px)');
  expect(document.querySelector('[data-testid="ui-composer-expand"]')).toBeNull();
  expect(document.querySelector('[data-testid="ui-expanded-composer"]')).toBeNull();
});

it('grows text upward without changing radius, bottom gap or control-row placement', async () => {
  await render('첫 줄');
  const bar = element('ui-chat-composer'), input = element<HTMLTextAreaElement>('ui-chat-input');
  const radius = bar.style.borderRadius, bottom = bar.style.bottom;
  const buttonBottom = element('ui-chat-send').parentElement!.style.bottom;
  const left = element('ui-chat-input-area').style.left;
  measured.height = 50;
  await render('첫 줄\n두 번째 줄');
  expect(element('ui-chat-input')).toBe(input);
  expect(parseFloat(bar.style.height)).toBe(128);
  expect(bar.style.borderRadius).toBe(radius);
  expect(bar.style.bottom).toBe(bottom);
  expect(element('ui-chat-send').parentElement!.style.bottom).toBe(buttonBottom);
  expect(element('ui-chat-input-area').style.left).toBe(left);
});

it('keeps send present but disabled for an empty or whitespace-only draft', async () => {
  await render('   ');
  const button = element('ui-chat-send');
  await act(async () => button.click());
  expect(send).not.toHaveBeenCalled();
  await render('안녕');
  expect(element('ui-chat-send')).toBe(button);
  expect(button.getAttribute('aria-disabled')).not.toBe('true');
  await act(async () => button.click());
  expect(send).toHaveBeenCalledOnce();
  await render();
  expect(element('ui-chat-send')).toBe(button);
  expect(parseFloat(element('ui-chat-composer').style.height)).toBe(106);
});

it('uses native input scrolling after seven lines without replacing the selected editor', async () => {
  const value = Array.from({length: 12}, (_, i) => `이야기 ${i + 1}`).join('\n');
  await render(value);
  const input = element<HTMLTextAreaElement>('ui-chat-input');
  await act(async () => {input.focus(); input.setSelectionRange(4, 9);});
  measured.height = 600;
  await render(value);
  expect(measured.props!.scrollable).toBe(true);
  expect(parseFloat(element('ui-chat-input-area').style.height)).toBeCloseTo(172.666666);
  expect(element('ui-chat-input')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([4, 9]);
  expect(input.value).toBe(value);
});

it('keeps a draft in the same input while adding and removing an attachment', async () => {
  await render('같이 볼래?');
  const input = element('ui-chat-input'), height = parseFloat(element('ui-chat-composer').style.height);
  const image = {id: 'test', title: '책 읽는 모습', tile: 0} as GalleryImage;
  await render('같이 볼래?', image);
  expect(parseFloat(element('ui-chat-composer').style.height)).toBe(height + 100);
  expect(element('ui-chat-input')).toBe(input);
  await act(async () => element('ui-chat-remove-image').click());
  expect(removeImage).toHaveBeenCalledOnce();
  await render('같이 볼래?');
  expect(parseFloat(element('ui-chat-composer').style.height)).toBe(height);
  expect(element('ui-chat-input')).toBe(input);
  await render('', image);
  expect(element('ui-chat-send').getAttribute('aria-disabled')).not.toBe('true');
});

it('pins desktop input until seven actual font lines, then preserves selection while scrolling and shrinking', async () => {
  measured.height = 19; measured.line = 19;
  await render('첫 줄', null, {}, true);
  const input = element<HTMLTextAreaElement>('ui-chat-input');
  const bottom = element('ui-chat-composer').style.bottom;
  const buttons = element('ui-chat-send').parentElement!.style.bottom;
  measured.height = 76;
  await render('첫 줄\n둘\n셋\n넷', null, {}, true);
  expect(element('ui-chat-input')).toBe(input);
  expect(measured.props!.scrollable).toBe(false);
  expect(parseFloat(element('ui-chat-input-area').style.height)).toBe(76);
  const long = Array.from({length: 11}, (_, i) => `이야기 ${i}`).join('\n');
  measured.height = 209;
  await render(long, null, {}, true);
  await act(async () => {input.focus(); input.setSelectionRange(3, 8);});
  expect(measured.props!.scrollable).toBe(true);
  expect(parseFloat(element('ui-chat-input-area').style.height)).toBe(133);
  expect(element('ui-chat-input')).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
  measured.height = 19;
  await render('짧은 줄', null, {}, true);
  expect(measured.props!.scrollable).toBe(false);
  expect(element('ui-chat-input')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(element('ui-chat-composer').style.bottom).toBe(bottom);
  expect(element('ui-chat-send').parentElement!.style.bottom).toBe(buttons);
});
