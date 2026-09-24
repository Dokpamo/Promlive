// @vitest-environment jsdom
import {act, type ReactNode, type Ref} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {ProfileEditor} from '../src/features/profile/ProfileEditor';
import {UserProfileProvider, useUserProfile} from '../src/features/profile/UserProfileContext';
import {UserProfilePreferences} from '../src/features/profile/userProfile';

const picker = vi.hoisted(() => vi.fn());
const editPhoto = vi.hoisted(() => vi.fn());
vi.mock('../src/adapters/profile/pickProfileImage', () => ({pickProfileImage: picker}));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({width: 412, height: 892}),
  View: ({children}: {children: ReactNode}) => <div>{children}</div>, Text: ({children}: {children: ReactNode}) => <span>{children}</span>, ActivityIndicator: () => <span>loading</span>, Keyboard: {dismiss: vi.fn()},
  TextInput: ({ref, value, onChangeText, onFocus, onBlur, editable, accessibilityLabel, autoFocus, selectTextOnFocus}: {ref: Ref<HTMLInputElement>; value: string; onChangeText: (value: string) => void; onFocus: () => void; onBlur: () => void; editable: boolean; accessibilityLabel: string; autoFocus: boolean; selectTextOnFocus: boolean}) => <input ref={ref} aria-label={accessibilityLabel} value={value} disabled={!editable} autoFocus={autoFocus} onInput={event => onChangeText(event.currentTarget.value)} onFocus={event => {if (selectTextOnFocus) event.currentTarget.select(); onFocus();}} onBlur={onBlur}/>,
}));
vi.mock('../src/layout/ScreenHeader', () => ({
  ScreenHeader: ({children}: {children: ReactNode}) => children,
  HeaderButton: ({label, onPress, disabled}: {label: string; onPress: () => void; disabled: boolean}) => <button aria-label={label} onClick={onPress} disabled={disabled}/>,
}));
vi.mock('../src/features/appearance/AppAppearance', () => ({useAppearance: () => ({settings: {text: '#222', secondary: '#888'}})}));
vi.mock('../src/layout/RowPressable', () => ({RowPressable: ({children, onPress, disabled, accessibilityLabel}: {children: ReactNode; onPress: () => void; disabled?: boolean; accessibilityLabel: string}) => <button aria-label={accessibilityLabel} onClick={onPress} disabled={disabled}>{children}</button>}));
vi.mock('../src/layout/SwipeBackModal', () => ({SwipeBackBoundary: ({children}: {children: ReactNode}) => <div>{children}</div>}));
vi.mock('../src/features/chat/ChatIcon', () => ({ChatIcon: () => <span/>}));
vi.mock('../src/features/settings/SettingsIcon', () => ({SettingsIcon: () => <span/>}));
vi.mock('../src/features/settings/SettingsLayout', () => ({SettingsNote: ({children}: {children: ReactNode}) => <span>{children}</span>, useSettingsScale: () => 1, panelReference: {}}));
vi.mock('../src/features/profile/UserAvatar', () => ({UserAvatar: ({image, testID}: {image: string | null; testID?: string}) => <span data-testid={testID} data-photo={image ?? ''}/> }));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
const oldImage = 'data:image/png;base64,b2xk';
const newPhoto = {uri: 'file:///selected.jpg', width: 800, height: 1200};
let root: Root | undefined;
afterEach(async () => {await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); picker.mockReset(); editPhoto.mockReset();});
function Account({location}: {location: string}) {const {value} = useUserProfile(); return <span data-account={location} data-photo={value.image}>{value.name}</span>;}
async function render(profile: UserProfilePreferences, onClose?: () => void) {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<UserProfileProvider store={profile}><Account location="settings"/><Account location="sidebar"/><ProfileEditor onEditPhoto={editPhoto} {...(onClose ? {onClose} : {})}/></UserProfileProvider>));
}
async function click(label: string) {await act(async () => {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  button.click();
});}
async function type(text: string) {await act(async () => {
  const input = document.querySelector('input')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
  input.dispatchEvent(new Event('input', {bubbles: true}));
});}

it('starts the editor with the restored profile even when loading finishes after it opens', async () => {
  let loaded!: (value: string) => void;
  const store = {getSetting: () => new Promise<string>(resolve => {loaded = resolve;}), setSetting: vi.fn()};
  await render(new UserProfilePreferences(store));
  expect(document.querySelector('input')).toBeNull();
  await act(async () => loaded(JSON.stringify({name: '저장된 이름', image: oldImage})));
  expect(document.querySelector('input')?.value).toBe('저장된 이름');
  expect(document.querySelector('input')?.selectionStart).toBe(0);
  expect(document.querySelector('input')?.selectionEnd).toBe('저장된 이름'.length);
  expect(document.querySelector('[data-testid="profile-photo-preview"]')?.getAttribute('data-photo')).toBe(oldImage);
});

it('opens crop editing from the avatar and keeps both saved photos unchanged until confirmation', async () => {
  const profile = new UserProfilePreferences({getSetting: async () => JSON.stringify({name: '사용자', image: oldImage}), setSetting: async () => {}});
  await render(profile);
  picker.mockResolvedValueOnce(null); await click('프로필 사진 선택');
  expect(profile.snapshot().value.image).toBe(oldImage);
  expect(editPhoto).not.toHaveBeenCalled();
  picker.mockResolvedValueOnce(newPhoto);
  await act(async () => document.querySelector<HTMLElement>('[data-testid="profile-photo-preview"]')!.click());
  expect(editPhoto).toHaveBeenCalledExactlyOnceWith(newPhoto);
  expect([...document.querySelectorAll('[data-account]')].map(item => item.getAttribute('data-photo'))).toEqual([oldImage, oldImage]);
  expect(document.body.textContent).not.toContain('적용');
  expect(document.querySelector('[aria-label="기본 이미지로 변경"]')).toBeNull();
  expect(profile.snapshot().value.image).toBe(oldImage);
});

it('edits the name in place, automatically saves, and restores the saved name if cleared and abandoned', async () => {
  const profile = new UserProfilePreferences({getSetting: async () => JSON.stringify({name: '사용자', image: oldImage}), setSetting: async () => {}});
  await render(profile);
  const input = document.querySelector('input')!;
  await type('새 이름');
  expect(document.querySelector('input')).toBe(input);
  expect([...document.querySelectorAll('[data-account]')].map(item => item.textContent)).toEqual(['새 이름', '새 이름']);
  await click('이름 지우기');
  expect(input.value).toBe('');
  expect(profile.snapshot().value.name).toBe('새 이름');
  await act(async () => input.blur());
  expect(input.value).toBe('새 이름');
});

it('finishes an automatic name save after the editor closes', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  let saved = '';
  const profile = new UserProfilePreferences({getSetting: async () => undefined, setSetting: async (_, value) => {await gate; saved = value;}});
  await render(profile);
  await type('닫기 직전 이름');
  await act(async () => {root?.unmount(); root = undefined;});
  await act(async () => release());
  expect(JSON.parse(saved).name).toBe('닫기 직전 이름');
});

it('keeps a failed name draft available for retry without an apply button', async () => {
  const store = {getSetting: async () => undefined, setSetting: vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)};
  const profile = new UserProfilePreferences(store);
  await render(profile); await type('다시 저장');
  expect(profile.snapshot().value.name).toBe('사용자');
  expect(document.querySelector('input')?.value).toBe('다시 저장');
  await click('이름 저장 다시 시도');
  expect(profile.snapshot().value.name).toBe('다시 저장');
  expect(document.querySelector('[aria-label="이름 저장 다시 시도"]')).toBeNull();
});

it('finishes pending automatic saves before the header check closes the profile', async () => {
  let release!: () => void;
  const close = vi.fn();
  const saved = vi.fn(() => new Promise<void>(resolve => {release = resolve;}));
  const profile = new UserProfilePreferences({getSetting: async () => undefined, setSetting: saved});
  await render(profile, close); await type('새 이름');
  await click('프로필 편집 완료');
  expect(close).not.toHaveBeenCalled();
  expect(document.querySelector<HTMLButtonElement>('[aria-label="프로필 편집 완료"]')!.disabled).toBe(true);
  await act(async () => release());
  expect(close).toHaveBeenCalledOnce();
  expect(profile.snapshot().value.name).toBe('새 이름');
});

it('keeps a failed profile draft open on confirmation and retries with the same check', async () => {
  const save = vi.fn().mockRejectedValue(new Error('disk full'));
  const profile = new UserProfilePreferences({getSetting: async () => undefined, setSetting: save});
  const close = vi.fn();
  await render(profile, close); await type('다시 저장');
  await click('프로필 편집 완료');
  expect(close).not.toHaveBeenCalled();
  expect(document.querySelector('input')!.value).toBe('다시 저장');
  save.mockResolvedValue(undefined);
  await click('프로필 편집 완료');
  expect(close).toHaveBeenCalledOnce();
  expect(profile.snapshot().value.name).toBe('다시 저장');
});

it('also closes from the header X', async () => {
  const close = vi.fn();
  await render(new UserProfilePreferences({getSetting: async () => undefined, setSetting: async () => {}}), close);
  await click('프로필 편집 닫기');
  expect(close).toHaveBeenCalledOnce();
});
