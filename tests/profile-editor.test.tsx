// @vitest-environment jsdom
import {act, type ReactNode, type Ref} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {ProfileEditor} from '../src/features/profile/ProfileEditor';
import {UserProfileProvider, useUserProfile} from '../src/features/profile/UserProfileContext';
import {UserProfilePreferences} from '../src/features/profile/userProfile';

const picker = vi.hoisted(() => vi.fn());
vi.mock('../src/adapters/profile/pickProfileImage', () => ({pickProfileImage: picker}));
vi.mock('react-native', () => ({
  View: ({children}: {children: ReactNode}) => <div>{children}</div>, Text: ({children}: {children: ReactNode}) => <span>{children}</span>, ActivityIndicator: () => <span>loading</span>, Keyboard: {dismiss: vi.fn()},
  TextInput: ({ref, value, onChangeText, onFocus, onBlur, editable, accessibilityLabel}: {ref: Ref<HTMLInputElement>; value: string; onChangeText: (value: string) => void; onFocus: () => void; onBlur: () => void; editable: boolean; accessibilityLabel: string}) => <input ref={ref} aria-label={accessibilityLabel} value={value} disabled={!editable} onInput={event => onChangeText(event.currentTarget.value)} onFocus={onFocus} onBlur={onBlur}/>,
}));
vi.mock('../src/features/appearance/AppAppearance', () => ({useAppearance: () => ({settings: {text: '#222', secondary: '#888'}})}));
vi.mock('../src/layout/RowPressable', () => ({RowPressable: ({children, onPress, disabled, accessibilityLabel}: {children: ReactNode; onPress: () => void; disabled?: boolean; accessibilityLabel: string}) => <button aria-label={accessibilityLabel} onClick={onPress} disabled={disabled}>{children}</button>}));
vi.mock('../src/layout/SwipeBackModal', () => ({SwipeBackBoundary: ({children}: {children: ReactNode}) => <div>{children}</div>}));
vi.mock('../src/features/chat/ChatIcon', () => ({ChatIcon: () => <span/>}));
vi.mock('../src/features/settings/SettingsLayout', () => ({SettingsNote: ({children}: {children: ReactNode}) => <span>{children}</span>, useSettingsScale: () => 1, panelReference: {}}));
vi.mock('../src/features/profile/UserAvatar', () => ({UserAvatar: ({image}: {image: string | null}) => <span data-photo={image ?? ''}/> }));

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
const oldImage = 'data:image/png;base64,b2xk';
const newImage = 'data:image/png;base64,bmV3';
let root: Root | undefined;
afterEach(async () => {await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); picker.mockReset();});
function Account({location}: {location: string}) {const {value} = useUserProfile(); return <span data-account={location} data-photo={value.image}>{value.name}</span>;}
async function render(profile: UserProfilePreferences) {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<UserProfileProvider store={profile}><Account location="settings"/><Account location="sidebar"/><ProfileEditor/></UserProfileProvider>));
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
  expect(document.querySelector('[aria-label="프로필 사진 선택"] [data-photo]')?.getAttribute('data-photo')).toBe(oldImage);
});

it('saves a picked photo directly to both accounts, while cancellation keeps the existing photo', async () => {
  const profile = new UserProfilePreferences({getSetting: async () => JSON.stringify({name: '사용자', image: oldImage}), setSetting: async () => {}});
  await render(profile);
  picker.mockResolvedValueOnce(null); await click('프로필 사진 선택');
  expect(profile.snapshot().value.image).toBe(oldImage);
  picker.mockResolvedValueOnce(newImage); await click('프로필 사진 선택');
  expect([...document.querySelectorAll('[data-account]')].map(item => item.getAttribute('data-photo'))).toEqual([newImage, newImage]);
  expect(document.body.textContent).not.toContain('적용');
  await click('기본 이미지로 변경');
  expect(profile.snapshot().value.image).toBeNull();
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
