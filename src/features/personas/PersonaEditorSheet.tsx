import {useEffect, useRef, useState, type RefObject} from 'react';
import {ActivityIndicator, Animated, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {pickProfileImage} from '../../adapters/profile/pickProfileImage';
import {KeyboardDock, KeyboardMotionProvider, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {focusWithKeyboard} from '../../layout/focusWithKeyboard';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackBoundary, SwipeBackModal} from '../../layout/SwipeBackModal';
import {headerScale, referenceHeader, referenceTypography} from '../../layout/metrics';
import {panelReference as g} from '../../layout/panelGeometry';
import {useAppearance} from '../appearance/AppAppearance';
import {useDrawerModalLock} from '../chat/DrawerGestureBoundary';
import {UserAvatar} from '../profile/UserAvatar';
import {ProfilePhotoCrop} from '../profile/ProfilePhotoCrop';
import type {ProfilePhoto} from '../profile/photoCrop';
import {SettingsIcon} from '../settings/SettingsIcon';
import {SettingsTextEditorHost, SettingsTextField, useTextEditorCovered} from '../settings/SettingsTextField';
import type {Persona, PersonaFields, PersonaPreferences} from './personaPreferences';

interface Props {item?: Persona; folderId?: string | null; store: PersonaPreferences; onClose: () => void; onDismissStart?: () => void; onCreated: () => void}

export function PersonaEditorSheet({item, folderId = null, store, onClose, onDismissStart, onCreated}: Props) {
  const [height, setHeight] = useState(0);
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<ProfilePhoto | null>(null);
  const [draft, setDraft] = useState<PersonaFields>(item ?? {name: '', description: '', image: null});
  const current = useRef(draft);
  const [error, setError] = useState('');
  const keyboardVisible = useRef(false);
  const pending = useRef(false);
  const writeAttempt = useRef(0);
  const mounted = useRef(false);
  const input = useRef<TextInput>(null);
  useDrawerModalLock(!closing);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const update = async (patch: Partial<PersonaFields>) => {
    const attempt = ++writeAttempt.current;
    current.current = {...current.current, ...patch}; setDraft(current.current); setError('');
    if (item && (patch.name === undefined || patch.name.trim())) {
      try {await store.update(item.id, patch);}
      catch (failure) {if (mounted.current && attempt === writeAttempt.current) setError('변경 내용을 저장하지 못했어요. 눌러서 다시 시도'); throw failure;}
    }
  };
  const change = (patch: Partial<PersonaFields>) => {void update(patch).catch(() => {});};
  const complete = async (close: () => void) => {
    if (pending.current || closing || !current.current.name.trim()) return;
    pending.current = true; setSaving(true); setError('');
    try {
      if (item) await store.update(item.id, current.current);
      else await store.create(current.current, folderId);
      if (mounted.current) {if (!item) onCreated(); close();}
    } catch {if (mounted.current) setError(item ? '변경 내용을 저장하지 못했어요. 눌러서 다시 시도' : '페르소나를 만들지 못했어요. 다시 시도해 주세요.');}
    finally {pending.current = false; if (mounted.current) setSaving(false);}
  };
  return <SwipeBackModal sheet sheetHeight={height} active={!saving} onClose={onClose} onShow={() => focusWithKeyboard(input.current)} onDismissStart={() => {
    if (Platform.OS !== 'web') input.current?.setNativeProps({editable: false});
    setClosing(true);
    onDismissStart?.();
  }} onBackRequest={() => {
    if (pending.current) return true;
    if (!keyboardVisible.current) return false;
    Keyboard.dismiss(); return true;
  }}>{(close, motionStyle) => <SettingsTextEditorHost resumeInput={input}><KeyboardMotionProvider>
    <PersonaEditorSurface draft={draft} editing={!!item} closing={closing} saving={saving} obscured={!!photo} error={error} input={input} keyboardVisible={keyboardVisible}
      change={change} retry={() => change(current.current)} onPhoto={setPhoto} onPhotoError={setError} close={close} complete={() => {void complete(close);}} motionStyle={motionStyle} onHeight={setHeight}/>
    {photo && <ProfilePhotoCrop photo={photo} onClose={() => setPhoto(null)} onSave={image => update({image})}/>}
  </KeyboardMotionProvider></SettingsTextEditorHost>}</SwipeBackModal>;
}

function PersonaEditorSurface({draft, editing, closing, saving, obscured, error, input, keyboardVisible, change, retry, onPhoto, onPhotoError, close, complete, motionStyle, onHeight}: {
  draft: PersonaFields; editing: boolean; closing: boolean; saving: boolean; obscured: boolean; error: string;
  input: RefObject<TextInput | null>; keyboardVisible: RefObject<boolean>; change: (patch: Partial<PersonaFields>) => void; retry: () => void;
  onPhoto: (photo: ProfilePhoto) => void; onPhotoError: (error: string) => void; close: () => void; complete: () => void;
  motionStyle: Animated.WithAnimatedObject<ViewStyle>; onHeight: (height: number) => void;
}) {
  const {settings: p, isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = headerScale(width);
  const gap = g.sheetInset * s;
  const bottom = insets.bottom + gap;
  const fraction = useRef(new Animated.Value(1)).current.interpolate({inputRange: [0, 1], outputRange: [1, 1]});
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const mounted = useRef(false);
  const focusedOnLayout = useRef(false);
  const covered = useTextEditorCovered();
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  keyboardVisible.current = useKeyboardFrame().height > 0;
  const pick = async () => {
    if (pickingRef.current || closing) return;
    pickingRef.current = true; setPicking(true); Keyboard.dismiss();
    try {const photo = await pickProfileImage(); if (photo && mounted.current) onPhoto(photo);}
    catch (cause) {if (mounted.current) onPhotoError(cause instanceof Error ? cause.message : '사진을 열지 못했어요.');}
    finally {pickingRef.current = false; if (mounted.current) setPicking(false);}
  };
  return <>
    <SwipeBackBoundary style={StyleSheet.absoluteFill}><Pressable accessibilityRole="button" accessibilityLabel="페르소나 편집 바깥 눌러 닫기" disabled={saving} onPress={close} style={{flex: 1}}/></SwipeBackBoundary>
    <KeyboardDock fraction={fraction} bottomInset={insets.bottom} freezeKeyboard={covered} followCaret={false}>
      <Animated.View testID="persona-editor" accessibilityViewIsModal pointerEvents={obscured ? 'none' : 'auto'} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'} onLayout={event => onHeight(event.nativeEvent.layout.height + bottom)}
        style={[{position: 'absolute', bottom, alignSelf: 'center', width: Math.min(g.contentMaxWidth, width - insets.left - insets.right - 2 * gap), paddingTop: gap, paddingBottom: g.groupPadding * s, borderRadius: g.radius * s, backgroundColor: p.sheet, overflow: 'hidden'}, motionStyle]}>
        <View pointerEvents="none" style={{position: 'absolute', alignSelf: 'center', top: g.sheetHandle.top * s, width: g.sheetHandle.width * s, height: g.sheetHandle.height * s, borderRadius: g.sheetHandle.radius * s, backgroundColor: p.divider}}/>
        <ScreenHeader width={width} edgeTint={false}>
          <SwipeBackBoundary><HeaderButton width={width} icon="close" label="페르소나 편집 닫기" disabled={saving} onPress={close}/></SwipeBackBoundary>
          <View pointerEvents="none" style={{flex: 1, height: referenceHeader.height * s, alignItems: 'center', justifyContent: 'center'}}><Text accessibilityRole="header" numberOfLines={1} style={{color: p.text, fontSize: referenceTypography.titleFontSize * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{editing ? '페르소나 편집' : '새 페르소나'}</Text></View>
          <SwipeBackBoundary><HeaderButton width={width} icon="check" label={editing ? '페르소나 편집 완료' : '페르소나 만들기'} disabled={saving || closing || !draft.name.trim()} onPress={complete}/></SwipeBackBoundary>
        </ScreenHeader>
        <RowPressable accessibilityRole="button" accessibilityLabel="페르소나 사진 선택" disabled={picking || closing || saving} onPress={() => {void pick();}} radius={g.controlRadius * s} style={{alignSelf: 'center'}} contentStyle={{padding: 12 * s}}>
          <UserAvatar image={draft.image} size={140 * s}/>
          <View pointerEvents="none" style={{position: 'absolute', right: 6 * s, bottom: 6 * s, width: 48 * s, height: 48 * s, borderRadius: 24 * s, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, borderWidth: 1.5 * s, borderColor: p.divider}}>{picking ? <ActivityIndicator color={p.secondary}/> : <SettingsIcon name="edit" size={24 * s} color={p.text}/>}</View>
        </RowPressable>
        <SwipeBackBoundary style={{marginHorizontal: g.rowInset * s, marginTop: 16 * s, marginBottom: 14 * s}}>
          <Text style={{color: focused ? p.text : p.secondary, fontSize: 22 * s, lineHeight: 32 * s}}>이름</Text>
          <TextInput ref={input} testID="persona-name-input" accessibilityLabel="페르소나 이름" value={draft.name} onChangeText={name => change({name})} editable={!closing && !saving} selectTextOnFocus
            onLayout={() => {if (!focusedOnLayout.current) {focusedOnLayout.current = true; focusWithKeyboard(input.current);}}}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="이름을 입력해 주세요" placeholderTextColor={p.faint} maxLength={40} autoCorrect={false}
            returnKeyType="done" underlineColorAndroid="transparent" cursorColor={p.accent} selectionColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.16)'} selectionHandleColor={p.accent}
            style={{height: g.rowHeight * s, color: p.text, fontSize: g.rowFont * s, paddingHorizontal: 0, paddingVertical: g.rowPadding * s, includeFontPadding: false}}/>
          <View pointerEvents="none" style={{height: 3 * s, marginTop: -g.inputUnderlineInset * s, justifyContent: 'flex-end'}}><View style={{height: (focused ? 3 : 1.5) * s, backgroundColor: focused ? p.accent : p.divider}}/></View>
        </SwipeBackBoundary>
        <SettingsTextField testID="persona-description" label="설명" value={draft.description} onChange={description => change({description})} placeholder="대화에서 사용할 나의 설정" multiline maxLength={2000}/>
        {!!error && <RowPressable accessibilityRole="button" accessibilityLabel="페르소나 저장 다시 시도" onPress={editing ? retry : complete} radius={g.controlRadius * s} contentStyle={{paddingHorizontal: g.rowInset * s, paddingVertical: 12 * s}}><Text accessibilityRole="alert" style={{color: p.secondary, fontSize: 22 * s}}>{error}</Text></RowPressable>}
      </Animated.View>
    </KeyboardDock>
  </>;
}
