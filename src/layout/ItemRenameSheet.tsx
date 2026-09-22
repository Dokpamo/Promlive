import {useEffect, useRef, useState, type RefObject} from 'react';
import {Animated, Keyboard, NativeModules, Platform, Pressable, StyleSheet, Text, TextInput, View, findNodeHandle, useWindowDimensions, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardDock, KeyboardMotionProvider, useKeyboardFrame} from './KeyboardMotion';
import {HeaderButton, ScreenHeader} from './ScreenHeader';
import {SwipeBackBoundary, SwipeBackModal} from './SwipeBackModal';
import {headerScale, referenceHeader, referenceTypography} from './metrics';
import {panelReference as g} from './panelGeometry';
import {useAppearance} from '../features/appearance/AppAppearance';
import {useDrawerModalLock} from '../features/chat/DrawerGestureBoundary';

interface RenameProps {
  item: {title: string};
  scope?: 'history' | 'card';
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
}

/** A short, keyboard-docked editor; the draft is committed only on confirmation. */
export function ItemRenameSheet({item, scope = 'history', onClose, onSave}: RenameProps) {
  const [height, setHeight] = useState(0);
  const [closing, setClosing] = useState(false);
  const input = useRef<TextInput>(null);
  const keyboardVisible = useRef(false);
  useDrawerModalLock();
  return <SwipeBackModal sheet sheetHeight={height} onClose={onClose} onShow={() => {
    input.current?.focus();
    const tag = Platform.OS === 'android' ? findNodeHandle(input.current) : null;
    if (tag) NativeModules.PromliveKeyboard?.showForInput?.(tag);
  }} onDismissStart={() => {
    if (Platform.OS !== 'web') input.current?.setNativeProps({editable: false, scrollEnabled: false});
    setClosing(true);
  }} onBackRequest={() => {
    if (!keyboardVisible.current) return false;
    Keyboard.dismiss();
    return true;
  }}>{(close, motionStyle) => <KeyboardMotionProvider>
    <RenameEditor item={item} scope={scope} onSave={onSave} close={close} closing={closing} input={input}
      keyboardVisible={keyboardVisible} motionStyle={motionStyle} onHeight={setHeight}/>
  </KeyboardMotionProvider>}</SwipeBackModal>;
}

function RenameEditor({item, scope, onSave, close, closing, input, keyboardVisible, motionStyle, onHeight}: Omit<RenameProps, 'onClose'> & {
  close: () => void;
  closing: boolean;
  input: RefObject<TextInput | null>;
  keyboardVisible: RefObject<boolean>;
  motionStyle: Animated.WithAnimatedObject<ViewStyle>;
  onHeight: (height: number) => void;
}) {
  const {settings: p, colors: c, isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  keyboardVisible.current = useKeyboardFrame().height > 0;
  const s = headerScale(width);
  const gap = g.sheetInset * s;
  const bottom = insets.bottom + gap;
  const [title, setTitle] = useState(item.title);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const closingRef = useRef(closing);
  closingRef.current = closing;
  const fraction = useRef(new Animated.Value(1)).current.interpolate({inputRange: [0, 1], outputRange: [1, 1]});
  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;};
  }, [input]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation(); close();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [close]);
  const save = async () => {
    if (pending.current || closingRef.current || !title.trim()) return;
    pending.current = true; setSaving(true); setError('');
    try {
      await onSave(title.trim());
      if (mounted.current && !closingRef.current) close();
    } catch (failure) {
      if (mounted.current && !closingRef.current) setError(failure instanceof Error ? failure.message : '이름을 저장하지 못했어요.');
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return <>
    <SwipeBackBoundary style={StyleSheet.absoluteFill}><Pressable testID={`${scope}-rename-dismiss`} accessibilityRole="button" accessibilityLabel="이름 변경 바깥 눌러 닫기" onPress={close} style={{flex: 1}}/></SwipeBackBoundary>
    <KeyboardDock fraction={fraction} bottomInset={insets.bottom} freezeKeyboard={false} followCaret={false}>
      <Animated.View testID={`${scope}-rename`} accessibilityViewIsModal onLayout={event => onHeight(event.nativeEvent.layout.height + bottom)}
        style={[{position: 'absolute', bottom, alignSelf: 'center', width: Math.min(440, width - insets.left - insets.right - 2 * gap), paddingTop: gap, paddingBottom: g.groupPadding * s,
          borderRadius: g.radius * s, backgroundColor: p.sheet, boxShadow: isDark ? '0px 6px 28px rgba(0,0,0,0.4)' : '0px 6px 28px rgba(0,0,0,0.15)'}, motionStyle]}>
        <View testID={`${scope}-rename-handle`} pointerEvents="none" style={{position: 'absolute', alignSelf: 'center', top: g.sheetHandle.top * s, width: g.sheetHandle.width * s, height: g.sheetHandle.height * s, borderRadius: g.sheetHandle.radius * s, backgroundColor: p.divider}}/>
        <ScreenHeader width={width} edgeTint={false}>
          <SwipeBackBoundary><HeaderButton width={width} icon="close" label="이름 변경 취소" onPress={close}/></SwipeBackBoundary>
          <View pointerEvents="none" style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}>
            <Text accessibilityRole="header" numberOfLines={1} style={{color: p.text, fontSize: referenceTypography.titleFontSize * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>이름 변경</Text>
          </View>
          <SwipeBackBoundary><HeaderButton width={width} icon="check" label="이름 변경 완료" disabled={saving || closing || !title.trim()} onPress={() => {void save();}}/></SwipeBackBoundary>
        </ScreenHeader>
        <SwipeBackBoundary style={{marginHorizontal: g.groupPadding * s}}>
          <TextInput ref={input} testID={`${scope}-rename-input`} accessibilityLabel={scope === 'card' ? '카드 이름' : '채팅 이름'} selectTextOnFocus value={title}
            maxLength={120} onChangeText={value => {setTitle(value); setError('');}} editable={!saving && !closing} autoCorrect={false}
            returnKeyType="done" submitBehavior="submit" onSubmitEditing={() => {void save();}}
            selectionColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.16)'} cursorColor={p.accent} underlineColorAndroid="transparent"
            style={{color: p.text, backgroundColor: 'transparent', paddingHorizontal: g.rowInset * s,
              paddingVertical: g.rowPadding * s, fontSize: g.rowFont * s, height: g.rowHeight * s, includeFontPadding: false}}/>
        </SwipeBackBoundary>
        {!!error && <Text accessibilityRole="alert" style={{color: c.error, fontSize: g.subtitle.fontSize * s, lineHeight: g.subtitle.lineHeight * s, marginTop: 12 * s, marginHorizontal: g.rowInset * s}}>{error}</Text>}
      </Animated.View>
    </KeyboardDock>
  </>;
}
