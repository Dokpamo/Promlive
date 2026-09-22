import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {Animated, Keyboard, Platform, Pressable, Text, TextInput, View, useWindowDimensions, type KeyboardTypeOptions, type TextInputProps, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardDock, KeyboardMotionProvider, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {PressSurface} from '../../layout/PressSurface';
import {useAppearance} from '../appearance/AppAppearance';
import {headerScale, referenceHeader, referenceTypography} from '../../layout/metrics';
import {composerEditorHeight, expandedComposerFrame} from '../chat/composerGeometry';
import {SettingsIcon} from './SettingsIcon';
import {SettingsSubtitle} from './SettingsSubtitle';
import {panelReference as r} from '../../layout/panelGeometry';
import {SwipeBackBoundary, SwipeBackModal} from '../../layout/SwipeBackModal';

interface FieldOptions {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  secret?: boolean;
  keyboard?: KeyboardTypeOptions;
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  testID?: string;
}
interface EditorSession extends FieldOptions {revision: number; closing: boolean}
const TextEditor = createContext<((field: FieldOptions) => void) | null>(null);

/** Keep the editor outside scrolling/clipped field rows, in the same modal window. */
export function SettingsTextEditorHost({children}: {children: ReactNode}) {
  const [editor, setEditor] = useState<EditorSession | null>(null);
  const revision = useRef(0);
  const open = useCallback((field: FieldOptions) => setEditor({...field, revision: ++revision.current, closing: false}), []);
  const obscured = editor !== null && !editor.closing;
  return <TextEditor.Provider value={open}>
    <View style={{flex: 1}}>
      <View style={{flex: 1}} pointerEvents={obscured ? 'none' : 'auto'} aria-hidden={obscured} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {editor && <SettingsTextEditor key={editor.revision} field={editor}
        onDismissStart={() => setEditor(current => current?.revision === editor.revision ? {...current, closing: true} : current)}
        onClose={() => setEditor(current => current?.revision === editor.revision ? null : current)}/>}
    </View>
  </TextEditor.Provider>;
}

export function SettingsTextField({detail, ...field}: FieldOptions & {detail?: string}) {
  const open = useContext(TextEditor);
  const {settings: p} = useAppearance();
  const s = headerScale(useWindowDimensions().width);
  const preview = field.secret && field.value ? '••••••••' : field.value || field.placeholder;
  return <View style={{marginBottom: r.groupGap * s}}>
    <SettingsSubtitle>{field.label}</SettingsSubtitle>
    <PressSurface testID={field.testID} accessibilityRole="button" accessibilityLabel={field.label}
      accessibilityValue={{text: field.secret ? field.value ? '등록됨' : '입력 안 함' : field.value || '입력 안 함'}}
      accessibilityHint="눌러서 입력창 열기" onPress={() => open?.(field)} radius={r.controlRadius * s} highlightColor={p.selected}
      contentStyle={{minHeight: 84 * s, paddingHorizontal: 24 * s, paddingVertical: 20 * s, backgroundColor: p.surface, flexDirection: 'row', alignItems: 'center', gap: 16 * s}}>
      <Text numberOfLines={3} ellipsizeMode="tail" style={{flex: 1, color: field.value ? p.text : p.faint, fontSize: 25 * s, lineHeight: 36 * s, includeFontPadding: false}}>{preview}</Text>
      <SettingsIcon name="chevron" size={24 * s} color={p.faint}/>
    </PressSurface>
    {detail && <Text style={{color: p.secondary, fontSize: 21 * s, lineHeight: 31 * s, marginTop: 10 * s, marginHorizontal: r.rowInset * s}}>{detail}</Text>}
  </View>;
}

function SettingsTextEditor({field, onDismissStart, onClose}: {field: FieldOptions; onDismissStart: () => void; onClose: () => void}) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sheet = expandedComposerFrame(window, insets);
  const [closing, setClosing] = useState(false);
  const input = useRef<TextInput>(null);
  const keyboardVisible = useRef(false);
  const beginDismiss = () => {
    // Release native editing/scroll responders before handing the next gesture back.
    if (Platform.OS !== 'web') input.current?.setNativeProps({editable: false, scrollEnabled: false});
    setClosing(true);
    onDismissStart();
  };
  return <SwipeBackModal sheet sheetHeight={window.height - sheet.y} onClose={onClose} onDismissStart={beginDismiss} onBackRequest={() => {
    if (!keyboardVisible.current) return false;
    Keyboard.dismiss();
    return true;
  }}>{(close, motionStyle) =>
    <KeyboardMotionProvider><TextEditorBody field={field} input={input} keyboardVisible={keyboardVisible} closing={closing} close={close} motionStyle={motionStyle}/></KeyboardMotionProvider>
  }</SwipeBackModal>;
}

function TextEditorBody({field, input, keyboardVisible, closing, close, motionStyle}: {
  field: FieldOptions; input: RefObject<TextInput | null>; keyboardVisible: RefObject<boolean>; closing: boolean; close: () => void; motionStyle: Animated.WithAnimatedObject<ViewStyle>;
}) {
  const {settings: p} = useAppearance();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardFrame();
  keyboardVisible.current = keyboard.height > 0;
  const s = headerScale(window.width);
  const sheet = expandedComposerFrame(window, insets);
  const [value, setValue] = useState(field.value);
  const [contentHeight, setContentHeight] = useState(0);
  const fraction = useRef(new Animated.Value(0)).current.interpolate({inputRange: [0, 1], outputRange: [0, 0]});
  const line = 40 * s;
  const inputTop = r.sheetInset * s + referenceHeader.barHeight * s + 16 * s;
  const measured = Math.max(line, contentHeight);
  const height = composerEditorHeight(sheet, inputTop, measured, line, 26 * s, window.height - keyboard.height);
  useEffect(() => {
    // Focus at mount so the keyboard starts with the sheet's entrance, not after it.
    input.current?.focus();
    return () => {input.current?.blur();};
  }, [input]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); close();}};
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [close]);
  return <KeyboardDock fraction={fraction} bottomInset={insets.bottom} freezeKeyboard followCaret={!closing}>
    <SwipeBackBoundary style={{position: 'absolute', inset: 0}}><Pressable accessibilityRole="button" accessibilityLabel="입력창 바깥 눌러 닫기" onPress={close} style={{flex: 1}}/></SwipeBackBoundary>
    <Animated.View testID="settings-text-editor" accessibilityViewIsModal style={[{position: 'absolute', left: sheet.x, top: sheet.y, width: sheet.width, height: sheet.height, borderRadius: sheet.radius, backgroundColor: p.sheet, overflow: 'hidden'}, motionStyle]}>
      <View testID="settings-text-editor-handle" pointerEvents="none" style={{position: 'absolute', alignSelf: 'center', top: r.sheetHandle.top * s, width: r.sheetHandle.width * s, height: r.sheetHandle.height * s, borderRadius: r.sheetHandle.radius * s, backgroundColor: p.divider}}/>
      <View pointerEvents="box-none" style={{position: 'absolute', top: r.sheetInset * s, left: 0, right: 0}}>
        <ScreenHeader width={window.width} edgeTint={false}>
          <HeaderButton width={window.width} icon="close" label="입력창 닫기" onPress={close}/>
          <View pointerEvents="none" style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}>{!field.secret && <Text accessibilityRole="header" numberOfLines={1} style={{color: p.text, fontSize: referenceTypography.titleFontSize * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{field.label}</Text>}</View>
          {field.secret ? <HeaderButton width={window.width} icon="check" label="입력 완료" onPress={close}/> : <View style={{width: referenceHeader.height * s}}/>}
        </ScreenHeader>
      </View>
      <SwipeBackBoundary style={{position: 'absolute', top: inputTop, left: 26 * s, right: 26 * s, height}}>
        <TextInput ref={input} testID={`${field.testID ?? 'settings-field'}-input`} accessibilityLabel={`${field.label} 입력`} value={value}
          onChangeText={next => {setValue(next); field.onChange(next);}} placeholder={field.secret ? '입력해 주세요' : field.placeholder} placeholderTextColor={p.faint}
          editable={!closing} autoFocus autoCapitalize={field.autoCapitalize ?? 'none'} autoCorrect={false} autoComplete="off" keyboardType={field.keyboard ?? 'default'}
          multiline={field.multiline ?? false} maxLength={field.maxLength ?? (field.secret ? 1024 : 500)}
          selectionColor={p.accent} underlineColorAndroid="transparent" textAlignVertical="top" scrollEnabled={!closing && measured > height + 1}
          onContentSizeChange={event => {const next = event.nativeEvent.contentSize.height; setContentHeight(old => Math.abs(old - next) > 0.5 ? next : old);}}
          onSubmitEditing={field.multiline ? undefined : close} returnKeyType={field.multiline ? 'default' : 'done'}
          style={{width: '100%', height: '100%', padding: 0, margin: 0, color: p.text, fontSize: 27 * s, lineHeight: line, includeFontPadding: false}}/>
      </SwipeBackBoundary>
    </Animated.View>
  </KeyboardDock>;
}
