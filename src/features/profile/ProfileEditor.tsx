import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Keyboard, Text, TextInput, View} from 'react-native';
import {pickProfileImage} from '../../adapters/profile/pickProfileImage';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackBoundary} from '../../layout/SwipeBackModal';
import {useAppearance} from '../appearance/AppAppearance';
import {ChatIcon} from '../chat/ChatIcon';
import {SettingsNote, useSettingsScale, panelReference as r} from '../settings/SettingsLayout';
import {UserAvatar} from './UserAvatar';
import {useUserProfile} from './UserProfileContext';
import type {UserProfile, UserProfilePreferences} from './userProfile';

export function ProfileEditor({closing = false}: {closing?: boolean}) {
  const {value, ready, error: loadError, store} = useUserProfile();
  const {settings: p} = useAppearance();
  const s = useSettingsScale();
  if (!ready || !store) return loadError ? <>
    <SettingsNote>{loadError}</SettingsNote>
    <RowPressable accessibilityRole="button" accessibilityLabel="프로필 다시 불러오기" onPress={() => {void store?.load();}} radius={r.controlRadius * s} contentStyle={{padding: 20 * s}}><Text style={{color: p.text, fontSize: r.rowFont * s}}>다시 불러오기</Text></RowPressable>
  </> : <ActivityIndicator color={p.secondary}/>;
  return <ProfileEditorFields value={value} store={store} closing={closing}/>;
}

function ProfileEditorFields({value, store, closing}: {value: UserProfile; store: UserProfilePreferences; closing: boolean}) {
  const [name, setName] = useState(value.name);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const nameWrite = useRef(0);
  const [nameError, setNameError] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const {settings: p, isDark} = useAppearance();
  const s = useSettingsScale();
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);

  const saveName = (text: string) => {
    const attempt = ++nameWrite.current;
    setNameError(false);
    // Clearing is an editing state, never an empty persisted profile name.
    if (!text.trim()) return;
    void store.update({name: text.trim()}).catch(() => {
      if (mounted.current && nameWrite.current === attempt) setNameError(true);
    });
  };
  const changeName = (text: string) => {setName(text); saveName(text);};
  const changePhoto = async (select: boolean) => {
    if (busyRef.current || closing) return;
    busyRef.current = true; setBusy(true); setPhotoError('');
    Keyboard.dismiss();
    try {
      const photo = select ? await pickProfileImage() : null;
      if (select && !photo) return;
      await store.update({image: photo});
    } catch (cause) {
      if (mounted.current) setPhotoError(cause instanceof Error ? cause.message : '사진을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return <>
    <RowPressable testID="profile-photo-picker" accessibilityRole="button" accessibilityLabel="프로필 사진 선택" disabled={busy || closing} onPress={() => {void changePhoto(true);}} radius={r.controlRadius * s} style={{alignSelf: 'center'}} contentStyle={{padding: 12 * s, alignItems: 'center', gap: 16 * s}}>
      <UserAvatar testID="profile-photo-preview" image={value.image} size={r.profileSize * s}/>
      {busy ? <ActivityIndicator color={p.secondary}/> : <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 34 * s}}>{value.image ? '사진 변경' : '사진 선택'}</Text>}
    </RowPressable>
    {value.image && <RowPressable accessibilityRole="button" accessibilityLabel="기본 이미지로 변경" disabled={busy || closing} onPress={() => {void changePhoto(false);}} radius={r.controlRadius * s} style={{alignSelf: 'center'}} contentStyle={{paddingHorizontal: 20 * s, paddingVertical: 12 * s}}><Text style={{color: p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>기본 이미지로 변경</Text></RowPressable>}
    <SwipeBackBoundary style={{marginTop: 26 * s, marginBottom: 20 * s}}>
      <Text style={{color: focused ? p.text : p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>이름</Text>
      <View style={{flexDirection: 'row', alignItems: 'center', minHeight: r.rowHeight * s}}>
        <TextInput ref={input} testID="profile-name-input" accessibilityLabel="프로필 이름" value={name} onChangeText={changeName} editable={!closing}
          onFocus={() => setFocused(true)} onBlur={() => {setFocused(false); if (!name.trim()) setName(store.snapshot().value.name);}}
          placeholder="이름을 입력해 주세요" placeholderTextColor={p.faint} maxLength={24} autoCorrect={false} autoCapitalize="sentences"
          returnKeyType="done" submitBehavior="blurAndSubmit" underlineColorAndroid="transparent" cursorColor={p.accent}
          selectionColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.16)'}
          style={{flex: 1, color: p.text, fontSize: r.rowFont * s, paddingHorizontal: 0, paddingVertical: r.rowPadding * s, includeFontPadding: false, backgroundColor: 'transparent'}}/>
        {!!name && <RowPressable testID="profile-name-clear" accessibilityRole="button" accessibilityLabel="이름 지우기" disabled={closing} onPress={() => {changeName(''); input.current?.focus();}} radius={28 * s} contentStyle={{width: 56 * s, height: 56 * s, alignItems: 'center', justifyContent: 'center'}}><ChatIcon name="close" size={26 * s} color={p.secondary}/></RowPressable>}
      </View>
      <View testID="profile-name-underline" pointerEvents="none" style={{height: 2 * s, justifyContent: 'flex-end'}}><View style={{height: (focused ? 2 : 1) * s, backgroundColor: focused ? p.accent : p.divider}}/></View>
    </SwipeBackBoundary>
    {nameError && <RowPressable accessibilityRole="button" accessibilityLabel="이름 저장 다시 시도" onPress={() => saveName(name)} radius={r.controlRadius * s} contentStyle={{paddingVertical: 16 * s}}><Text style={{color: p.secondary, fontSize: 24 * s}}>이름을 저장하지 못했어요. 눌러서 다시 시도</Text></RowPressable>}
    {!!photoError && <SettingsNote>{photoError}</SettingsNote>}
  </>;
}
