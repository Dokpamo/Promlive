// @vitest-environment jsdom
import {act, useEffect, useState, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {PersonaEditorSheet} from '../src/features/personas/PersonaEditorSheet';
import {PersonaPreferences} from '../src/features/personas/personaPreferences';

vi.mock('react-native', async () => ({
  ...await vi.importActual<typeof import('react-native')>('react-native-web'),
  useWindowDimensions: () => ({width: 412, height: 892, fontScale: 1, scale: 1}),
  AccessibilityInfo: {isReduceMotionEnabled: async () => false, addEventListener: () => ({remove() {}})},
}));
vi.mock('react-native-safe-area-context', () => ({useSafeAreaInsets: () => ({top: 24, bottom: 24, left: 0, right: 0})}));
vi.mock('../src/layout/SwipeBackModal', () => ({
  SwipeBackModal: ({children, onClose, onDismissStart, onShow}: {children: (close: () => void, style: object) => ReactNode; onClose: () => void; onDismissStart: () => void; onShow?: () => void}) => {
    useEffect(() => {onShow?.();}, []);
    return children(() => {onDismissStart(); onClose();}, {});
  },
  SwipeBackBoundary: ({children}: {children: ReactNode}) => children,
}));
vi.mock('../src/layout/KeyboardMotion', () => ({KeyboardMotionProvider: ({children}: {children: ReactNode}) => children, KeyboardDock: ({children}: {children: ReactNode}) => children, useKeyboardFrame: () => ({height: 0})}));
vi.mock('../src/layout/ScreenHeader', () => ({
  ScreenHeader: ({children}: {children: ReactNode}) => children,
  HeaderButton: ({label, onPress, disabled}: {label: string; onPress: () => void; disabled: boolean}) => <button aria-label={label} onClick={onPress} disabled={disabled}/>,
}));
vi.mock('../src/features/settings/SettingsTextField', () => ({SettingsTextEditorHost: ({children}: {children: ReactNode}) => children, SettingsTextField: () => null, useTextEditorCovered: () => false}));
vi.mock('../src/adapters/profile/pickProfileImage', () => ({pickProfileImage: vi.fn()}));
vi.mock('../src/features/profile/ProfilePhotoCrop', () => ({ProfilePhotoCrop: () => null}));
vi.mock('../src/features/profile/UserAvatar', () => ({UserAvatar: () => null}));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(async () => {await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren();});
async function setup(editing = true) {
  const save = vi.fn(async (_key: string, _value: string) => {});
  const store = new PersonaPreferences({getSetting: async () => undefined, setSetting: save});
  const item = editing ? await store.create({name: '여행자', description: '기존 설명', image: null}) : undefined;
  const close = vi.fn(), created = vi.fn();
  function Host() {
    const [open, setOpen] = useState(true);
    return open ? <PersonaEditorSheet {...(item ? {item} : {})} store={store} onClose={() => {close(); setOpen(false);}} onCreated={created}/> : null;
  }
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<Host/>));
  return {store, save, close, created, item};
}
function button(label: string) {return document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;}
async function press(label: string) {await act(async () => button(label).click());}
async function rename(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>('[aria-label="페르소나 이름"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

it('waits for pending automatic edits before the edit check closes, without creating another persona', async () => {
  const {store, save, close, created, item} = await setup();
  expect(document.activeElement).toBe(document.querySelector('[aria-label="페르소나 이름"]'));
  const create = vi.spyOn(store, 'create');
  let release!: () => void;
  save.mockImplementationOnce(() => new Promise<void>(resolve => {release = resolve;}));
  await rename('새 이름');
  await press('페르소나 편집 완료');
  expect(button('페르소나 편집 완료').disabled).toBe(true);
  expect(close).not.toHaveBeenCalled();
  await act(async () => release());
  expect(close).toHaveBeenCalledOnce();
  expect(store.snapshot().value.items.find(value => value.id === item!.id)).toMatchObject({name: '새 이름', description: '기존 설명'});
  expect(create).not.toHaveBeenCalled();
  expect(created).not.toHaveBeenCalled();
});

it('keeps the editor open after a failed completion and lets the same check retry', async () => {
  const {save, close} = await setup();
  save.mockRejectedValueOnce(new Error('저장 실패'));
  await press('페르소나 편집 완료');
  expect(close).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('저장하지 못했어요');
  await press('페르소나 편집 완료');
  expect(close).toHaveBeenCalledOnce();
});

it('still uses the creation check for a new persona and requires a name', async () => {
  const {store, close, created} = await setup(false);
  expect(button('페르소나 만들기').disabled).toBe(true);
  expect(button('페르소나 편집 완료')).toBeNull();
  await rename('새 페르소나'); await press('페르소나 만들기');
  expect(store.snapshot().value.items.filter(item => item.name === '새 페르소나')).toHaveLength(1);
  expect(created).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
});
