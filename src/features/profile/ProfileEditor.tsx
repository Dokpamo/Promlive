import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Keyboard, Text, TextInput, View, useWindowDimensions} from 'react-native';
import {pickProfileImage} from '../../adapters/profile/pickProfileImage';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackBoundary} from '../../layout/SwipeBackModal';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {useAppearance} from '../appearance/AppAppearance';
import {ChatIcon} from '../chat/ChatIcon';
import {SettingsIcon} from '../settings/SettingsIcon';
import {SettingsNote, useSettingsScale, panelReference as r} from '../settings/SettingsLayout';
import {UserAvatar} from './UserAvatar';
import {useUserProfile} from './UserProfileContext';
import type {UserProfile, UserProfilePreferences} from './userProfile';
import type {ProfilePhoto} from './photoCrop';

export function ProfileEditor({closing = false, onEditPhoto, onClose}: {closing?: boolean; onEditPhoto: (photo: ProfilePhoto) => void; onClose?: () => void}) {
  const {value, ready, error: loadError, store} = useUserProfile();
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  if (!ready || !store) return loadError ? <>
    <SettingsNote>{loadError}</SettingsNote>
    <RowPressable accessibilityRole="button" accessibilityLabel="프로필 다시 불러오기" onPress={() => {void store?.load();}} radius={r.controlRadius * s} contentStyle={{padding: 20 * s}}><Text style={{color: p.text, fontSize: r.rowFont * s}}>다시 불러오기</Text></RowPressable>
  </> : <ActivityIndicator color={p.secondary}/>;
  return <ProfileEditorFields value={value} store={store} closing={closing} onEditPhoto={onEditPhoto} onClose={onClose}/>;
}

function ProfileEditorFields({value, store, closing, onEditPhoto, onClose}: {value: UserProfile; store: UserProfilePreferences; closing: boolean; onEditPhoto: (photo: ProfilePhoto) => void; onClose: (() => void) | undefined}) {
  const [name, setName] = useState(value.name);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const nameWrite = useRef(0);
  const [nameError, setNameError] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const completing = useRef(false);
  const {settings: p, isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const s = useSettingsScale();
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);

  const saveName = async (text: string) => {
    const attempt = ++nameWrite.current;
    setNameError(false);
    // Clearing is an editing state, never an empty persisted profile name.
    if (!text.trim()) return;
    try {await store.update({name: text.trim()});} catch (error) {
      if (mounted.current && nameWrite.current === attempt) setNameError(true);
      throw error;
    }
  };
  const changeName = (text: string) => {setName(text); void saveName(text).catch(() => {});};
  const complete = async () => {
    if (closing || completing.current || !name.trim()) return;
    completing.current = true; setSaving(true);
    try {await saveName(name); if (mounted.current) onClose?.();}
    catch {/* The same draft stays open with the existing retry action. */}
    finally {completing.current = false; if (mounted.current) setSaving(false);}
  };
  const changePhoto = async () => {
    if (busyRef.current || closing) return;
    busyRef.current = true; setBusy(true); setPhotoError('');
    Keyboard.dismiss();
    try {
      const photo = await pickProfileImage();
      if (!photo || !mounted.current) return;
      onEditPhoto(photo);
    } catch (cause) {
      if (mounted.current) setPhotoError(cause instanceof Error ? cause.message : '사진을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return <>
    {onClose && <ScreenHeader width={width} edgeTint={false}>
      <SwipeBackBoundary><HeaderButton width={width} testID="profile-sheet-close" icon="close" label="프로필 편집 닫기" disabled={saving || closing} onPress={onClose}/></SwipeBackBoundary>
      <View pointerEvents="none" style={{flex: 1}}/>
      <SwipeBackBoundary><HeaderButton width={width} testID="profile-sheet-done" icon="check" label="프로필 편집 완료" disabled={saving || closing || busy || !name.trim()} onPress={() => {void complete();}}/></SwipeBackBoundary>
    </ScreenHeader>}
    <View style={{paddingHorizontal: r.sheetPadding * s}}>
    <RowPressable testID="profile-photo-picker" accessibilityRole="button" accessibilityLabel="프로필 사진 선택" accessibilityState={{busy}} disabled={busy || closing || saving} onPress={() => {void changePhoto();}}
      radius={r.controlRadius * s} style={{alignSelf: 'center'}} contentStyle={{padding: 12 * s}}>
      <UserAvatar testID="profile-photo-preview" image={value.image} size={r.profileSize * s}/>
      <View pointerEvents="none" style={{position: 'absolute', right: 8 * s, bottom: 8 * s, width: 60 * s, height: 60 * s, borderRadius: 30 * s, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, borderWidth: 1.5 * s, borderColor: p.divider}}>
        {busy ? <ActivityIndicator color={p.secondary}/> : <SettingsIcon name="edit" color={p.text} size={28 * s}/>}
      </View>
    </RowPressable>
    <SwipeBackBoundary style={{marginTop: 26 * s, marginBottom: 20 * s}}>
      <Text style={{color: focused ? p.text : p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>이름</Text>
      <View style={{flexDirection: 'row', alignItems: 'center', minHeight: r.rowHeight * s}}>
        <TextInput ref={input} testID="profile-name-input" accessibilityLabel="프로필 이름" value={name} onChangeText={changeName} editable={!closing && !saving} autoFocus selectTextOnFocus
          onFocus={() => setFocused(true)} onBlur={() => {setFocused(false); if (!name.trim()) setName(store.snapshot().value.name);}}
          placeholder="이름을 입력해 주세요" placeholderTextColor={p.faint} maxLength={24} autoCorrect={false} autoCapitalize="sentences"
          returnKeyType="done" submitBehavior="blurAndSubmit" underlineColorAndroid="transparent" cursorColor={p.accent}
          selectionColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.16)'} selectionHandleColor={p.accent}
          style={{flex: 1, color: p.text, fontSize: r.rowFont * s, paddingHorizontal: 0, paddingVertical: r.rowPadding * s, includeFontPadding: false, backgroundColor: 'transparent'}}/>
        {!!name && <RowPressable testID="profile-name-clear" accessibilityRole="button" accessibilityLabel="이름 지우기" disabled={closing || saving} onPress={() => {changeName(''); input.current?.focus();}} radius={28 * s} contentStyle={{width: 56 * s, height: 56 * s, alignItems: 'center', justifyContent: 'center'}}><ChatIcon name="close" size={26 * s} color={p.secondary}/></RowPressable>}
      </View>
      <View testID="profile-name-underline" pointerEvents="none" style={{height: 3 * s, marginTop: -r.inputUnderlineInset * s, justifyContent: 'flex-end'}}><View style={{height: (focused ? 3 : 1.5) * s, backgroundColor: focused ? p.accent : p.divider}}/></View>
    </SwipeBackBoundary>
    {nameError && <RowPressable accessibilityRole="button" accessibilityLabel="이름 저장 다시 시도" onPress={() => {void saveName(name).catch(() => {});}} radius={r.controlRadius * s} contentStyle={{paddingVertical: 16 * s}}><Text style={{color: p.secondary, fontSize: 24 * s}}>이름을 저장하지 못했어요. 눌러서 다시 시도</Text></RowPressable>}
    {!!photoError && <SettingsNote>{photoError}</SettingsNote>}
    </View>
  </>;
}
