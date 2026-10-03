import {usePalette, themedStyles} from './Theme';
import {createRef, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent} from 'react-native';
import {KeyboardPage} from './KeyboardPage';
import type {EditableCardField, WorkCard} from './cardWorkspace';
import {missingCardFields} from './cardWorkspace';
import {nightLibraryDetails, type GalleryImage} from './cardDetails';
import {NavigationButton} from './Navigation';
import {PreviewArtwork} from './PreviewArtwork';
import {navigation} from './tokens';
import type {ScreenMemory} from './ScreenMemory';
import {usePlainScrollMemory} from './usePlainScrollMemory';
import {SwipeBack} from './SwipeBack';
import {FilterChips} from './FilterChips';
import {EditorTextInput} from './EditorTextInput';
import type {GestureBlockRef} from './HorizontalGesture.types';
import type {BackTransition} from './backTransition';
import {useDesktopPane} from './desktop/DesktopPane';
import {desktopMetrics} from './desktop/desktopMetrics';

/** Edits the new UI's draft. Only Complete updates the library's published snapshot. */
export function CardEditor({card, scale, topInset, bottomInset, onChange, onGalleryChange, onComplete, onClose, memory, backTransition}: {
  card: WorkCard;
  scale: number;
  topInset: number;
  bottomInset: number;
  onChange: (field: EditableCardField, value: string) => void;
  onGalleryChange: (images: GalleryImage[]) => void;
  onComplete: () => void;
  onClose: () => void;
  memory: ScreenMemory;
  backTransition: BackTransition;
}) {
  const colors = usePalette();
  const baseStyles = useStyles(), desktop = useDesktopPane();
  const styles = desktop ? {...baseStyles,
    body: {...baseStyles.body, paddingHorizontal: 28},
    label: {...baseStyles.label, ...desktopMetrics.body},
    input: {...baseStyles.input, ...desktopMetrics.body, minHeight: 40, borderBottomWidth: 0, backgroundColor: colors.inputSurface, borderRadius: 12, paddingHorizontal: 12,
      ...(Platform.OS === 'macos' ? {fontFamily: 'Apple SD Gothic Neo', lineHeight: undefined} : {})},
  } : baseStyles;
  const [group, setGroup] = useState<'basic' | 'story' | 'images'>('basic');
  const [titleError, setTitleError] = useState(false);
  const [tagText, setTagText] = useState(card.draft.tags.join(', '));
  const titleInput = useRef<TextInput>(null);
  const blockers = useMemo(() => Array.from({length: 7}, () => createRef() as GestureBlockRef), []);
  const scroll = useRef<ScrollView>(null);
  const scrolling = usePlainScrollMemory(memory, 'editor', scroll);
  const focusedField = useRef<EditableCardField | null>(null);
  const fieldOffsets = useRef<Partial<Record<EditableCardField, number>>>({});
  const groupOffsets = useRef({basic: 0, story: 0});
  const keyboardVisible = useRef(false);
  const revealFocusedField = useCallback(() => {
    const field = focusedField.current;
    const offset = field ? fieldOffsets.current[field] : undefined;
    if (field && offset !== undefined) {
      const groupOffset = groupOffsets.current[['summary', 'introduction', 'guide'].includes(field) ? 'story' : 'basic'];
      scroll.current?.scrollTo({y: Math.max(0, groupOffset + offset - 44), animated: true});
    }
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
    if (missingCardFields(card.draft).length) {
      setTitleError(true);
      const first = missingCardFields(card.draft)[0];
      setGroup(first === 'summary' || first === 'introduction' ? 'story' : first === 'gallery' ? 'images' : 'basic');
      scroll.current?.scrollTo({y: 0, animated: false});
      return;
    }
    Keyboard.dismiss();
    onComplete();
  }
  // Android keeps the root canvas fixed, so the editor must shrink its own viewport.
  return <SwipeBack identity={card.id} onBack={onClose} blockers={blockers} transition={backTransition}>
    <KeyboardPage testID="ui-card-editor" keyboardVerticalOffset={topInset}
    style={[styles.screen, {paddingBottom: bottomInset}]}>
    <View testID="ui-card-editor-header" style={[styles.header, {height: navigation.headerHeight * scale}]}>
      <NavigationButton testID="ui-card-editor-back" icon="back" label="이전 화면으로 돌아가기" scale={scale} onPress={onClose}/>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerTitle, {fontSize: navigation.titleSize * scale, lineHeight: navigation.titleLineHeight * scale, fontWeight: '700'}]}>{card.draft.title ? '카드 편집' : '카드 만들기'}</Text>
      <Pressable testID="ui-card-editor-complete" accessibilityRole="button" accessibilityLabel="완료하고 서재에 반영"
        onPress={complete} style={styles.complete}>
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
      <View style={{marginHorizontal: -navigation.titleInset * 2 / 3}}>
        <FilterChips scope="editor" scale={scale} items={[{id: 'basic', label: '기본 정보'}, {id: 'story', label: '이야기'}, {id: 'images', label: '이미지'}]} selected={group}
          onChange={next => {Keyboard.dismiss(); setGroup(next); scroll.current?.scrollTo({y: 0, animated: false});}}/>
      </View>
      {titleError && missingCardFields(card.draft).length > 0 && <Text accessibilityRole="alert" style={styles.error}>
        완료하려면 {missingCardFields(card.draft).map(field => ({title: '제목', creator: '제작자', tags: '태그', summary: '소개', introduction: '인트로', gallery: '갤러리'}[field])).join(' · ')} 항목을 채워 주세요.
      </Text>}
      <View testID="ui-editor-basic-fields" aria-hidden={group !== 'basic'} style={{display: group === 'basic' ? 'flex' : 'none'}}
        onLayout={event => {groupOffsets.current.basic = event.nativeEvent.layout.y;}}>
      <Text style={styles.label} nativeID="card-title-label">제목</Text>
      <EditorTextInput ref={titleInput} blockerRef={blockers[0]!} testID="ui-card-editor-title" accessibilityLabel="카드 제목" aria-labelledby="card-title-label"
        {...inputEvents('title')}
        value={card.draft.title} onChangeText={value => {setTitleError(false); onChange('title', value);}}
        placeholder="카드 제목" placeholderTextColor={colors.secondaryForeground} style={styles.input} multiline underlineColorAndroid="transparent"/>
      <Text style={styles.label} nativeID="card-character-label">캐릭터 이름</Text>
      <EditorTextInput blockerRef={blockers[1]!} testID="ui-card-editor-character" accessibilityLabel="캐릭터 이름" aria-labelledby="card-character-label"
        {...inputEvents('character')}
        value={card.draft.character} onChangeText={value => onChange('character', value)} placeholder="캐릭터 이름"
        placeholderTextColor={colors.secondaryForeground} style={styles.input} underlineColorAndroid="transparent"/>
      <Text style={styles.label}>제작자</Text>
      <EditorTextInput blockerRef={blockers[4]!} testID="ui-card-editor-creator" accessibilityLabel="제작자"
        {...inputEvents('creator')} value={card.draft.creator} onChangeText={value => onChange('creator', value)} style={styles.input}/>
      <Text style={styles.label}>태그</Text>
      <EditorTextInput blockerRef={blockers[5]!} testID="ui-card-editor-tags" accessibilityLabel="태그, 쉼표로 구분"
        {...inputEvents('tags')} value={tagText} onChangeText={value => {setTagText(value); onChange('tags', value);}}
        placeholder="일상, 판타지, 도서관" placeholderTextColor={colors.secondaryForeground} style={styles.input}/>
      </View>
      <View testID="ui-editor-story-fields" aria-hidden={group !== 'story'} style={{display: group === 'story' ? 'flex' : 'none'}}
        onLayout={event => {groupOffsets.current.story = event.nativeEvent.layout.y;}}>
      <Text style={styles.label} nativeID="card-summary-label">소개</Text>
      <EditorTextInput blockerRef={blockers[2]!} testID="ui-card-editor-summary" accessibilityLabel="카드 소개" aria-labelledby="card-summary-label"
        {...inputEvents('summary')}
        value={card.draft.summary} onChangeText={value => onChange('summary', value)} placeholder="어떤 이야기인지 소개해 주세요."
        placeholderTextColor={colors.secondaryForeground} style={[styles.input, styles.summary]} multiline textAlignVertical="top" underlineColorAndroid="transparent"/>
      <Text style={styles.label} nativeID="card-introduction-label">인트로</Text>
      <EditorTextInput blockerRef={blockers[3]!} testID="ui-card-editor-introduction" accessibilityLabel="시작 장면" aria-labelledby="card-introduction-label"
        {...inputEvents('introduction')}
        value={card.draft.introduction} onChangeText={value => onChange('introduction', value)} placeholder="첫 장면을 적어 주세요."
        placeholderTextColor={colors.secondaryForeground} style={[styles.input, styles.introduction]} multiline textAlignVertical="top" underlineColorAndroid="transparent"/>
      <Text style={styles.label}>가이드 · 선택</Text>
      <EditorTextInput blockerRef={blockers[6]!} testID="ui-card-editor-guide" accessibilityLabel="가이드, 선택 사항"
        {...inputEvents('guide')} value={card.draft.guide} onChangeText={value => onChange('guide', value)}
        placeholder="플레이 방법이나 권장 설정을 적어 주세요." placeholderTextColor={colors.secondaryForeground}
        style={[styles.input, styles.introduction]} multiline textAlignVertical="top" underlineColorAndroid="transparent"/>
      </View>
      <View testID="ui-editor-images-fields" aria-hidden={group !== 'images'} style={{display: group === 'images' ? 'flex' : 'none'}}>
      <Text style={styles.label}>갤러리 · 최소 1장</Text>
      <View testID="ui-card-editor-gallery" style={styles.gallery}>
        {[...new Map([{id: 'cover', tile: card.draft.tile, title: '대표 이미지'}, ...nightLibraryDetails.gallery].map(picture => [picture.tile, picture])).values()].map(picture => {
          const selected = card.draft.gallery.some(image => image.tile === picture.tile);
          return <Pressable key={picture.tile} testID={`ui-card-editor-photo-${picture.tile}`} accessibilityRole="checkbox" accessibilityState={{checked: selected}}
            accessibilityLabel={picture.title} onPress={() => onGalleryChange(selected ? card.draft.gallery.filter(image => image.tile !== picture.tile) : [...card.draft.gallery, picture])}
            style={[styles.galleryImage, {borderColor: selected ? colors.foreground : 'transparent'}]}>
            <PreviewArtwork tile={picture.tile} width={80} height={80}/>
            {selected && <View style={styles.selectedPhoto}><Text style={{color: colors.selectedForeground}}>✓</Text></View>}
          </Pressable>;
        })}
      </View>
      </View>
    </ScrollView>
  </KeyboardPage></SwipeBack>;
}

const useStyles = themedStyles(colors => ({
  screen: {flex: 1, minHeight: 0, backgroundColor: colors.background},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: navigation.backInset, flexShrink: 0, backgroundColor: colors.background},
  headerTitle: {flex: 1, marginLeft: 12, fontSize: 20, lineHeight: 28, fontWeight: '600', color: colors.foreground},
  complete: {minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center'},
  completeText: {fontSize: 16, fontWeight: '600', color: colors.foreground},
  content: {flex: 1, minHeight: 0, overflow: 'hidden'},
  body: {paddingHorizontal: navigation.titleInset * 2 / 3, paddingTop: 20, paddingBottom: 36},
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
  gallery: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  galleryImage: {width: 84, height: 84, overflow: 'hidden', borderRadius: 12, borderWidth: 2},
  selectedPhoto: {position: 'absolute', bottom: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedBackground},
}));
