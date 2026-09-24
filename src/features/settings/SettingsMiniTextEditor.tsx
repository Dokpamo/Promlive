import {useEffect, useRef, useState, type RefObject} from 'react';
import {Animated, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppearance} from '../appearance/AppAppearance';
import {useDrawerModalLock} from '../chat/DrawerGestureBoundary';
import {KeyboardDock, KeyboardMotionProvider, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {SwipeBackBoundary, SwipeBackModal} from '../../layout/SwipeBackModal';
import {focusWithKeyboard} from '../../layout/focusWithKeyboard';
import {headerScale, referenceHeader, referenceTypography} from '../../layout/metrics';
import {panelReference as g} from '../../layout/panelGeometry';
import type {FieldOptions} from './SettingsTextField';

/** Short settings use the same keyboard-docked proportions as name editing. */
export function SettingsMiniTextEditor({field, onDismissStart, onClose}: {
  field: FieldOptions; onDismissStart: () => void; onClose: () => void;
}) {
  const [height, setHeight] = useState(0);
  const [closing, setClosing] = useState(false);
  const input = useRef<TextInput>(null);
  const keyboardVisible = useRef(false);
  useDrawerModalLock(!closing);
  return <SwipeBackModal sheet sheetHeight={height} onClose={onClose} onShow={() => focusWithKeyboard(input.current)} onDismissStart={() => {
    if (Platform.OS !== 'web') input.current?.setNativeProps({editable: false, scrollEnabled: false});
    setClosing(true);
    onDismissStart();
  }} onBackRequest={() => {
    if (!keyboardVisible.current) return false;
    Keyboard.dismiss();
    return true;
  }}>{(close, motionStyle) => <KeyboardMotionProvider>
    <MiniEditorBody field={field} input={input} keyboardVisible={keyboardVisible} closing={closing} close={close} motionStyle={motionStyle} onHeight={setHeight}/>
  </KeyboardMotionProvider>}</SwipeBackModal>;
}

function MiniEditorBody({field, input, keyboardVisible, closing, close, motionStyle, onHeight}: {
  field: FieldOptions; input: RefObject<TextInput | null>; keyboardVisible: RefObject<boolean>; closing: boolean;
  close: () => void; motionStyle: Animated.WithAnimatedObject<ViewStyle>; onHeight: (height: number) => void;
}) {
  const {settings: p, isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  keyboardVisible.current = useKeyboardFrame().height > 0;
  const s = headerScale(width), gap = g.sheetInset * s, bottom = insets.bottom + gap;
  const [value, setValue] = useState(field.value);
  const [focused, setFocused] = useState(false);
  const focusedOnLayout = useRef(false);
  const fraction = useRef(new Animated.Value(1)).current.interpolate({inputRange: [0, 1], outputRange: [1, 1]});
  const change = (next: string) => {if (!closing) {setValue(next); field.onChange(next);}};
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopImmediatePropagation(); close();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [close]);
  const titleInset = (referenceHeader.inset + referenceHeader.height + referenceHeader.gap
    + (field.resetValue === undefined ? 0 : referenceHeader.height + referenceHeader.gap)) * s;
  return <>
    <SwipeBackBoundary style={StyleSheet.absoluteFill}><Pressable accessibilityRole="button" accessibilityLabel="입력창 바깥 눌러 닫기" onPress={close} style={{flex: 1}}/></SwipeBackBoundary>
    <KeyboardDock fraction={fraction} bottomInset={insets.bottom} freezeKeyboard={false} followCaret={false}>
      <Animated.View testID="settings-mini-text-editor" accessibilityViewIsModal onLayout={event => onHeight(event.nativeEvent.layout.height + bottom)}
        style={[{position: 'absolute', bottom, alignSelf: 'center', width: Math.min(440, width - insets.left - insets.right - 2 * gap), paddingTop: gap, paddingBottom: g.groupPadding * s,
          borderRadius: g.radius * s, backgroundColor: p.sheet, boxShadow: isDark ? '0px 6px 28px rgba(0,0,0,0.4)' : '0px 6px 28px rgba(0,0,0,0.15)'}, motionStyle]}>
        <View pointerEvents="none" style={{position: 'absolute', alignSelf: 'center', top: g.sheetHandle.top * s, width: g.sheetHandle.width * s, height: g.sheetHandle.height * s, borderRadius: g.sheetHandle.radius * s, backgroundColor: p.divider}}/>
        <ScreenHeader width={width} edgeTint={false}>
          <SwipeBackBoundary><HeaderButton width={width} testID="settings-text-editor-close" icon="close" label="입력창 닫기" onPress={close}/></SwipeBackBoundary>
          <View pointerEvents="none" style={{flex: 1}}/>
          {field.resetValue !== undefined && <SwipeBackBoundary><HeaderButton width={width} testID="settings-text-editor-reset" icon="reset" label="기본 주소로 되돌리기" disabled={closing} onPress={() => {
            change(field.resetValue!);
            focusWithKeyboard(input.current);
          }}/></SwipeBackBoundary>}
          <SwipeBackBoundary><HeaderButton width={width} testID="settings-text-editor-done" icon="check" label="입력 완료" disabled={closing} onPress={close}/></SwipeBackBoundary>
          {!field.secret && <View pointerEvents="none" style={{position: 'absolute', left: titleInset, right: titleInset, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}>
            <Text accessibilityRole="header" numberOfLines={1} style={{color: p.text, fontSize: referenceTypography.titleFontSize * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{field.label}</Text>
          </View>}
        </ScreenHeader>
        <SwipeBackBoundary style={{marginHorizontal: g.groupPadding * s}}>
          <TextInput ref={input} testID={`${field.testID ?? 'settings-field'}-input`} accessibilityLabel={`${field.label} 입력`} value={value} selectTextOnFocus
            onLayout={() => {if (!focusedOnLayout.current) {focusedOnLayout.current = true; focusWithKeyboard(input.current);}}}
            onChangeText={change} editable={!closing} scrollEnabled={!closing} placeholder={field.secret ? '입력해 주세요' : field.placeholder} placeholderTextColor={p.faint}
            maxLength={field.maxLength ?? (field.secret ? 1024 : 500)} autoCapitalize={field.autoCapitalize ?? 'none'} autoCorrect={false} autoComplete="off" keyboardType={field.keyboard ?? 'default'}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} returnKeyType="done" submitBehavior="submit" onSubmitEditing={close}
            selectionColor={isDark ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.16)'} cursorColor={p.accent} underlineColorAndroid="transparent"
            style={{color: p.text, backgroundColor: 'transparent', paddingHorizontal: g.rowInset * s, paddingVertical: g.rowPadding * s, fontSize: g.rowFont * s, height: g.rowHeight * s, includeFontPadding: false}}/>
          <View testID="settings-mini-text-editor-underline" pointerEvents="none" style={{height: 3 * s, marginTop: -g.inputUnderlineInset * s, marginHorizontal: g.rowInset * s, justifyContent: 'flex-end'}}>
            <View style={{height: (focused ? 3 : 1.5) * s, backgroundColor: focused ? p.accent : p.divider}}/>
          </View>
        </SwipeBackBoundary>
      </Animated.View>
    </KeyboardDock>
  </>;
}
