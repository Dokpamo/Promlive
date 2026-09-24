import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {Animated, Keyboard, Platform, Text, TextInput, View, useWindowDimensions, type KeyboardTypeOptions, type TextInputProps} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardDock, KeyboardMotionProvider, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {PressSurface} from '../../layout/PressSurface';
import {useAppearance} from '../appearance/AppAppearance';
import {headerScale, referenceHeader, referenceTypography} from '../../layout/metrics';
import {expandedComposerFrame} from '../chat/composerGeometry';
import {SettingsIcon} from './SettingsIcon';
import {SettingsSubtitle} from './SettingsSubtitle';
import {panelReference as r} from '../../layout/panelGeometry';
import {SwipeBackModal} from '../../layout/SwipeBackModal';
import {useBlankDismiss} from '../../layout/useBlankDismiss';
import {DragClickBoundary} from '../../layout/DragClickBoundary';
import {focusWithKeyboard} from '../../layout/focusWithKeyboard';

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
const TextEditorCovered = createContext(false);
export function useTextEditorCovered() {return useContext(TextEditorCovered);}

/** Keep the editor outside scrolling/clipped field rows, in the same modal window. */
export function SettingsTextEditorHost({children, resumeInput}: {children: ReactNode; resumeInput?: RefObject<TextInput | null>}) {
  const [editor, setEditor] = useState<EditorSession | null>(null);
  const revision = useRef(0);
  const wasCovered = useRef(false);
  useEffect(() => {
    const restore = !editor && wasCovered.current && resumeInput?.current;
    wasCovered.current = editor !== null;
    if (!restore) return;
    // Fabric removes the outgoing native field after React's commit. Restore
    // focus after that frame too, so Android cannot select a background input.
    const frame = requestAnimationFrame(() => focusWithKeyboard(restore));
    return () => cancelAnimationFrame(frame);
  }, [editor, resumeInput]);
  const open = useCallback((field: FieldOptions) => setEditor({...field, revision: ++revision.current, closing: false}), []);
  const obscured = editor !== null && !editor.closing;
  return <TextEditor.Provider value={open}>
    <View style={{flex: 1}}>
      <TextEditorCovered.Provider value={editor !== null}><View style={{flex: 1}} pointerEvents={obscured ? 'none' : 'auto'} aria-hidden={obscured} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}>{children}</View></TextEditorCovered.Provider>
      {editor && <SettingsTextEditor key={editor.revision} field={editor} keepKeyboard={resumeInput !== undefined}
        onDismissStart={() => {
          if (revision.current !== editor.revision) return;
          // Transfer native focus before the outgoing input unmounts, keeping the IME open.
          if (resumeInput?.current) focusWithKeyboard(resumeInput.current);
          setEditor(current => current?.revision === editor.revision ? {...current, closing: true} : current);
        }}
        onClose={() => {if (revision.current === editor.revision) setEditor(null);}}/>}
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
      contentStyle={{minHeight: 84 * s, paddingHorizontal: r.rowInset * s, paddingVertical: 20 * s, backgroundColor: p.surface, flexDirection: 'row', alignItems: 'center', gap: 16 * s}}>
      <Text numberOfLines={3} ellipsizeMode="tail" style={{flex: 1, color: field.value ? p.text : p.faint, fontSize: 25 * s, lineHeight: 36 * s, includeFontPadding: false}}>{preview}</Text>
      <SettingsIcon name="chevron" size={24 * s} color={p.faint}/>
    </PressSurface>
    {detail && <Text style={{color: p.secondary, fontSize: 21 * s, lineHeight: 31 * s, marginTop: 10 * s, marginHorizontal: r.rowInset * s}}>{detail}</Text>}
  </View>;
}

function SettingsTextEditor({field, keepKeyboard, onDismissStart, onClose}: {field: FieldOptions; keepKeyboard: boolean; onDismissStart: () => void; onClose: () => void}) {
  const window = useWindowDimensions();
  const [closing, setClosing] = useState(false);
  const input = useRef<TextInput>(null);
  const dismiss = useRef<(() => void) | null>(null);
  const keyboardVisible = useRef(false);
  const beginDismiss = () => {
    // Release native editing/scroll responders before handing the next gesture back.
    if (Platform.OS !== 'web' && !keepKeyboard) input.current?.setNativeProps({editable: false, scrollEnabled: false});
    setClosing(true);
    onDismissStart();
  };
  return <SwipeBackModal fixed sheet sheetHeight={window.height} onClose={onClose} onDismissStart={beginDismiss} onBackRequest={() => {
    if (keyboardVisible.current) Keyboard.dismiss();
    else dismiss.current?.();
    return true;
  }}>{close =>
    <KeyboardMotionProvider><TextEditorBody field={field} keepKeyboard={keepKeyboard} input={input} dismiss={dismiss} keyboardVisible={keyboardVisible} closing={closing} close={close}/></KeyboardMotionProvider>
  }</SwipeBackModal>;
}

function TextEditorBody({field, keepKeyboard, input, dismiss, keyboardVisible, closing, close}: {
  field: FieldOptions; keepKeyboard: boolean; input: RefObject<TextInput | null>; dismiss: RefObject<(() => void) | null>; keyboardVisible: RefObject<boolean>; closing: boolean; close: () => void;
}) {
  const {settings: p} = useAppearance();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardFrame();
  keyboardVisible.current = keyboard.height > 0;
  const s = headerScale(window.width);
  const sheet = expandedComposerFrame(window);
  const [keyboardStarted, setKeyboardStarted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const exitStarted = useRef(false);
  const pull = useBlankDismiss({active: !closing, height: sheet.height, onClose: close, entrance: keyboardStarted ? 'ready' : 'waiting', onDismissStart: () => {
    exitStarted.current = true;
    setExiting(true);
    if (!keepKeyboard) Keyboard.dismiss();
  }});
  useLayoutEffect(() => {dismiss.current = pull.dismiss; return () => {dismiss.current = null;};}, [dismiss, pull.dismiss]);
  const [value, setValue] = useState(field.value);
  const [contentHeight, setContentHeight] = useState(0);
  const fraction = useRef(new Animated.Value(0)).current.interpolate({inputRange: [0, 1], outputRange: [0, 0]});
  const footerFraction = useRef(new Animated.Value(1)).current.interpolate({inputRange: [0, 1], outputRange: [1, 1]});
  const line = 40 * s;
  const inputTop = insets.top + referenceHeader.barHeight * s + 16 * s;
  const footerHeight = Math.max(0, insets.bottom - keyboard.height) + (r.sheetInset + referenceHeader.height + 16) * s;
  const measured = Math.max(line, contentHeight);
  const height = Math.max(line, window.height - keyboard.height - inputTop - footerHeight);
  useEffect(() => {
    let cancelled = false;
    focusWithKeyboard(input.current, () => {if (!cancelled && !exitStarted.current) setKeyboardStarted(true);});
    return () => {cancelled = true; if (!keepKeyboard) input.current?.blur();};
  }, [input, keepKeyboard]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); pull.dismiss();}};
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [pull.dismiss]);
  // This native input already ends above the keyboard and follows its own caret.
  // A second reveal pass during the screen's entrance can scroll past its first line.
  return <KeyboardDock fraction={fraction} bottomInset={insets.bottom} freezeKeyboard followCaret={false}><DragClickBoundary cancelClick={pull.cancelClick}>
    <Animated.View testID="settings-text-editor" accessibilityViewIsModal onAccessibilityEscape={pull.dismiss} pointerEvents={exiting ? 'none' : 'auto'} {...pull.panHandlers} style={{position: 'absolute', left: sheet.x, top: sheet.y, width: sheet.width, height: sheet.height, borderRadius: sheet.radius, backgroundColor: p.sheet, overflow: 'hidden', transform: [{translateY: pull.y}]}}>
      <View onStartShouldSetResponderCapture={pull.block} pointerEvents="box-none" style={{position: 'absolute', top: insets.top, left: insets.left, right: insets.right}}>
        <ScreenHeader width={window.width} edgeTint={false}>
          <View pointerEvents="none" style={{width: referenceHeader.height * s}}/>
          <View pointerEvents="none" style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}>{!field.secret && <Text accessibilityRole="header" numberOfLines={1} style={{color: p.text, fontSize: referenceTypography.titleFontSize * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{field.label}</Text>}</View>
          <HeaderButton width={window.width} testID="settings-text-editor-close" icon="close" label="입력창 닫기" onPress={pull.dismiss}/>
        </ScreenHeader>
      </View>
      <View testID="settings-text-editor-viewport" pointerEvents="box-none" style={{position: 'absolute', top: inputTop, left: insets.left + 26 * s, right: insets.right + 26 * s, height}}>
      <View onStartShouldSetResponderCapture={pull.block} style={{height: Math.min(measured, height)}}>
        <TextInput ref={input} testID={`${field.testID ?? 'settings-field'}-input`} accessibilityLabel={`${field.label} 입력`} value={value}
          onChangeText={next => {setValue(next); field.onChange(next);}} placeholder={field.secret ? '입력해 주세요' : field.placeholder} placeholderTextColor={p.faint}
          editable={!closing && (!exiting || keepKeyboard)} autoCapitalize={field.autoCapitalize ?? 'none'} autoCorrect={false} autoComplete="off" keyboardType={field.keyboard ?? 'default'}
          multiline={field.multiline ?? false} maxLength={field.maxLength ?? (field.secret ? 1024 : 500)}
          selectionColor={p.accent} underlineColorAndroid="transparent" textAlignVertical="top" scrollEnabled={!closing && !exiting && measured > height + 1}
          onContentSizeChange={event => {const next = event.nativeEvent.contentSize.height; setContentHeight(old => Math.abs(old - next) > 0.5 ? next : old);}}
          onSubmitEditing={field.multiline ? undefined : pull.dismiss} returnKeyType={field.multiline ? 'default' : 'done'}
          style={{width: '100%', height: '100%', padding: 0, margin: 0, color: p.text, fontSize: 27 * s, lineHeight: line, includeFontPadding: false}}/>
      </View>
      </View>
      <KeyboardDock fraction={footerFraction} bottomInset={insets.bottom} freezeKeyboard={false} followCaret={false}>
        <View testID="settings-text-editor-footer" onStartShouldSetResponderCapture={pull.block} pointerEvents="box-none" style={{position: 'absolute', right: insets.right + referenceHeader.inset * s, bottom: insets.bottom + r.sheetInset * s}}>
          <HeaderButton width={window.width} testID="settings-text-editor-done" icon="check" label="입력 완료" bright onPress={pull.dismiss}/>
        </View>
      </KeyboardDock>
    </Animated.View>
  </DragClickBoundary></KeyboardDock>;
}
