import {createRef, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent} from 'react-native';
import type {EditableCardField, WorkCard} from './cardWorkspace';
import {NavigationButton} from './Navigation';
import {PreviewArtwork} from './PreviewArtwork';
import {colors, navigation} from './tokens';
import type {ScreenMemory} from './ScreenMemory';
import {usePlainScrollMemory} from './usePlainScrollMemory';
import {SwipeBack} from './SwipeBack';
import {EditorTextInput} from './EditorTextInput';
import type {GestureBlockRef} from './HorizontalGesture.types';
import type {BackTransition} from './backTransition';

/** Edits the new UI's draft. Only Complete updates the library's published snapshot. */
export function CardEditor({card, scale, topInset, bottomInset, onChange, onComplete, onClose, memory, backTransition}: {
  card: WorkCard;
  scale: number;
  topInset: number;
  bottomInset: number;
  onChange: (field: EditableCardField, value: string) => void;
  onComplete: () => void;
  onClose: () => void;
  memory: ScreenMemory;
  backTransition: BackTransition;
}) {
  const [titleError, setTitleError] = useState(false);
  const titleInput = useRef<TextInput>(null);
  const blockers = useMemo(() => Array.from({length: 4}, () => createRef() as GestureBlockRef), []);
  const scroll = useRef<ScrollView>(null);
  const scrolling = usePlainScrollMemory(memory, 'editor', scroll);
  const focusedField = useRef<EditableCardField | null>(null);
  const fieldOffsets = useRef<Partial<Record<EditableCardField, number>>>({});
  const keyboardVisible = useRef(false);
  const revealFocusedField = useCallback(() => {
    const field = focusedField.current;
    const offset = field ? fieldOffsets.current[field] : undefined;
    if (offset !== undefined) scroll.current?.scrollTo({y: Math.max(0, offset - 44), animated: true});
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let frame: number | undefined;
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      keyboardVisible.current = true;
      frame = requestAnimationFrame(revealFocusedField);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {keyboardVisible.current = false;});
    return () => {shown.remove(); hidden.remove(); if (frame !== undefined) cancelAnimationFrame(frame);};
  }, [revealFocusedField]);
  function inputEvents(field: EditableCardField) {
    return {
      onLayout: (event: LayoutChangeEvent) => {fieldOffsets.current[field] = event.nativeEvent.layout.y;},
      onFocus: () => {focusedField.current = field; if (keyboardVisible.current) revealFocusedField();},
      onBlur: () => {if (focusedField.current === field) focusedField.current = null;},
    };
  }
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {onClose(); return true;});
    return () => subscription.remove();
  }, [onClose]);
  function complete() {
    if (!card.draft.title.trim()) {setTitleError(true); titleInput.current?.focus(); return;}
    Keyboard.dismiss();
    onComplete();
  }
  // Android keeps the root canvas fixed, so the editor must shrink its own viewport.
  return <SwipeBack identity={card.id} onBack={onClose} blockers={blockers} transition={backTransition}>
    <KeyboardAvoidingView testID="ui-card-editor" keyboardVerticalOffset={topInset}
    behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
    style={[styles.screen, {paddingBottom: bottomInset}]}>
    <View testID="ui-card-editor-header" style={[styles.header, {height: navigation.headerHeight * scale}]}>
      <NavigationButton testID="ui-card-editor-back" icon="back" label="이전 화면으로 돌아가기" scale={scale} onPress={onClose}/>
      <Text accessibilityRole="header" style={styles.headerTitle}>카드 편집</Text>
      <Pressable testID="ui-card-editor-complete" accessibilityRole="button" accessibilityLabel="완료하고 서재에 반영"
        onPress={complete} style={({pressed}) => [styles.complete, {opacity: pressed ? 0.55 : 1}]}>
        <Text style={styles.completeText}>완료</Text>
      </Pressable>
    </View>
    <ScrollView ref={scroll} {...scrolling} testID="ui-card-editor-content" style={styles.content} contentContainerStyle={styles.body}
      onLayout={event => {scrolling.onLayout(event); if (keyboardVisible.current) revealFocusedField();}}
      bounces overScrollMode="auto" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.identity}>
        <View testID="ui-card-editor-cover" style={styles.cover}><PreviewArtwork tile={card.draft.tile} width={72} height={96}/></View>
        <View style={styles.identityText}>
          <Text testID="ui-card-editor-status" style={styles.status}>{card.origin === 'external' ? '외부 카드' : '내 카드'} · {card.working ? '작업 중' : '완성'}</Text>
          <Text style={styles.creator}>{card.draft.creator}</Text>
          <Text style={styles.publicationHint}>{card.published ? '완료하면 서재의 카드에 반영돼요.' : '완료하면 서재에 표시돼요.'}</Text>
        </View>
      </View>
      <Text style={styles.label} nativeID="card-title-label">제목</Text>
      <EditorTextInput ref={titleInput} blockerRef={blockers[0]!} testID="ui-card-editor-title" accessibilityLabel="카드 제목" aria-labelledby="card-title-label"
        {...inputEvents('title')}
        value={card.draft.title} onChangeText={value => {setTitleError(false); onChange('title', value);}}
        placeholder="카드 제목" placeholderTextColor={colors.secondaryForeground} style={styles.input} multiline underlineColorAndroid="transparent"/>
      {titleError && <Text accessibilityRole="alert" style={styles.error}>완료하려면 제목을 입력해 주세요.</Text>}
      <Text style={styles.label} nativeID="card-character-label">캐릭터 이름</Text>
      <EditorTextInput blockerRef={blockers[1]!} testID="ui-card-editor-character" accessibilityLabel="캐릭터 이름" aria-labelledby="card-character-label"
        {...inputEvents('character')}
        value={card.draft.character} onChangeText={value => onChange('character', value)} placeholder="캐릭터 이름"
        placeholderTextColor={colors.secondaryForeground} style={styles.input} underlineColorAndroid="transparent"/>
      <Text style={styles.label} nativeID="card-summary-label">소개</Text>
      <EditorTextInput blockerRef={blockers[2]!} testID="ui-card-editor-summary" accessibilityLabel="카드 소개" aria-labelledby="card-summary-label"
        {...inputEvents('summary')}
        value={card.draft.summary} onChangeText={value => onChange('summary', value)} placeholder="어떤 이야기인지 소개해 주세요."
        placeholderTextColor={colors.secondaryForeground} style={[styles.input, styles.summary]} multiline textAlignVertical="top" underlineColorAndroid="transparent"/>
      <Text style={styles.label} nativeID="card-introduction-label">시작 장면</Text>
      <EditorTextInput blockerRef={blockers[3]!} testID="ui-card-editor-introduction" accessibilityLabel="시작 장면" aria-labelledby="card-introduction-label"
        {...inputEvents('introduction')}
        value={card.draft.introduction} onChangeText={value => onChange('introduction', value)} placeholder="첫 장면을 적어 주세요."
        placeholderTextColor={colors.secondaryForeground} style={[styles.input, styles.introduction]} multiline textAlignVertical="top" underlineColorAndroid="transparent"/>
    </ScrollView>
  </KeyboardAvoidingView></SwipeBack>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, minHeight: 0, backgroundColor: colors.background},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: navigation.backInset, flexShrink: 0, backgroundColor: colors.background},
  headerTitle: {flex: 1, marginLeft: 12, fontSize: 20, lineHeight: 28, fontWeight: '600', color: colors.foreground},
  complete: {minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center'},
  completeText: {fontSize: 16, fontWeight: '600', color: colors.foreground},
  content: {flex: 1, minHeight: 0, overflow: 'hidden'},
  body: {paddingHorizontal: 22, paddingTop: 20, paddingBottom: 36},
  identity: {flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 24},
  cover: {width: 72, height: 96, overflow: 'hidden', backgroundColor: colors.surface},
  identityText: {flex: 1, minWidth: 0, gap: 7},
  status: {fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.foreground},
  creator: {fontSize: 14, lineHeight: 20, color: colors.secondaryForeground},
  publicationHint: {fontSize: 13, lineHeight: 19, color: colors.secondaryForeground},
  label: {marginTop: 16, marginBottom: 8, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.foreground},
  input: {paddingVertical: 12, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: colors.separator,
    fontSize: 16, lineHeight: 25, minHeight: 48, color: colors.foreground},
  summary: {minHeight: 92},
  introduction: {minHeight: 150},
  error: {marginTop: 8, fontSize: 13, color: colors.error},
});
