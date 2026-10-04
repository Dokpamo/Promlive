import type {LibraryCard} from '../features/workspace/model';
import {usePalette, themedStyles} from './Theme';
import {useEffect, useRef, useState} from 'react';
import {BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Icon} from './Icon';
import {NavigationButton} from './Navigation';
import {PreviewArtwork, previewArtworkRatio} from './PreviewArtwork';
import type {ScreenMemoryController as ScreenMemory} from './ScreenController';
import {listTypography, navigation, navigationActionMetrics} from './tokens';
import {usePlainScrollMemory} from './usePlainScrollMemory';
import {SwipeBack} from './SwipeBack';
import type {BackTransition} from './backTransition';

/** Published content only; independent controls leave the original cover unobstructed. */
export function CardDetail({card, width, scale, bottomInset, active, memory, onClose, onEdit, onViewImage, onStartChat, backTransition}: {
  card: LibraryCard; width: number; scale: number; bottomInset: number; active: boolean;
  memory: ScreenMemory; onClose: () => void; onEdit: () => void; onViewImage: (index?: number) => void; onStartChat: () => void;
  backTransition: BackTransition;
}) {
  const colors = usePalette();
  const styles = useStyles();
  const [menuOpen, setMenuOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const scrolling = usePlainScrollMemory(memory, 'detail', scroll);
  const actions = navigationActionMetrics(scale);
  const {top: topInset} = useSafeAreaInsets();
  const buttonTop = topInset + actions.top;
  const inset = navigation.titleInset * scale;
  useEffect(() => {if (!active) setMenuOpen(false);}, [active]);
  useEffect(() => {
    if (!active || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuOpen) setMenuOpen(false); else onClose();
      return true;
    });
    return () => subscription.remove();
  }, [active, menuOpen, onClose]);
  return <SwipeBack identity={card.id} enabled={active && !menuOpen} onBack={onClose} transition={backTransition} drawBehindStatusBar>
    <View testID="ui-card-detail" style={styles.screen}>
    <ScrollView ref={scroll} {...scrolling} testID="ui-card-detail-content" style={styles.content}
      contentContainerStyle={styles.body} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      bounces overScrollMode="auto" showsVerticalScrollIndicator={false}>
      <Pressable testID="ui-card-detail-cover" accessibilityRole="button" accessibilityLabel={`${card.title} 대표 이미지 크게 보기`} onPress={() => onViewImage()}
        style={{width, height: width / previewArtworkRatio(card.tile), overflow: 'hidden', backgroundColor: colors.surface}}>
        <PreviewArtwork tile={card.tile} width={width} height={width / previewArtworkRatio(card.tile)} fullImage/>
      </Pressable>
      <View style={{paddingHorizontal: inset, paddingTop: 20}}>
        <Text testID="ui-card-detail-title" accessibilityRole="header" style={{...styles.title,
          fontSize: navigation.titleSize * scale, lineHeight: navigation.titleLineHeight * scale}}>{card.title}</Text>
        <Text style={styles.creator}>제작자 <Text style={styles.creatorName}>{card.creator}</Text></Text>
        <View testID="ui-card-detail-tags" style={styles.tags}>{card.tags.map((tag, index) =>
          <View key={`${tag}-${index}`} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>
        {!!card.summary && <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>소개</Text>
          <Text testID="ui-card-detail-summary" style={styles.paragraph}>{card.summary}</Text>
        </View>}
        {!!card.gallery.length && <View style={styles.section}>
          <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>갤러리</Text>
            <Text style={styles.count}>{card.gallery.length}장</Text></View>
          <View testID="ui-card-detail-gallery" style={styles.gallery}>
            {card.gallery.map((picture, index) => <Pressable key={picture.id} testID={`ui-card-gallery-${index}`}
              accessibilityRole="button" accessibilityLabel={`${picture.title}, ${index + 1}/${card.gallery.length}, 크게 보기`}
              onPress={() => onViewImage(index)} style={{width: '33.333%', aspectRatio: 1, borderWidth: 1, borderColor: colors.background, overflow: 'hidden', backgroundColor: colors.surface}}>
              <PreviewArtwork tile={picture.tile} width={(width - inset * 2) / 3 - 2} height={(width - inset * 2) / 3 - 2}/>
            </Pressable>)}
          </View>
        </View>}
        {!!card.introduction && <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>인트로</Text>
          <Text testID="ui-card-detail-introduction" style={styles.paragraph}>{card.introduction}</Text>
        </View>}
        {!!card.guide && <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>가이드</Text>
          <Text testID="ui-card-detail-guide" style={styles.paragraph}>{card.guide}</Text>
        </View>}
      </View>
    </ScrollView>
    <View style={[styles.footer, {paddingHorizontal: inset, paddingBottom: bottomInset + 22}]}>
      <Pressable testID="ui-card-detail-start" accessibilityRole="button" accessibilityLabel="대화 시작"
        onPress={onStartChat} style={[styles.start, {minHeight: 90 * scale, borderRadius: 32 * scale}]}>
        <Text style={styles.startText}>대화 시작</Text>
      </Pressable>
    </View>
    {menuOpen && <Pressable testID="ui-card-detail-menu-dismiss" accessibilityRole="button" accessibilityLabel="메뉴 닫기"
      onPress={() => setMenuOpen(false)} style={styles.menuDismiss}/>}
    <NavigationButton testID="ui-card-detail-back" icon="back" label="서재로 돌아가기" scale={scale} onPress={onClose}
      style={[styles.floatingButton, {top: buttonTop, left: actions.backInset, borderRadius: actions.size / 2}]}/>
    <NavigationButton testID="ui-card-detail-more" icon="more" label="카드 메뉴" scale={scale}
      onPress={() => setMenuOpen(open => !open)} expanded={menuOpen}
      style={[styles.floatingButton, {top: buttonTop, right: actions.endInset, borderRadius: actions.size / 2}]}/>
    {menuOpen && <View testID="ui-card-detail-menu" style={[styles.menu, {right: actions.endInset, top: buttonTop + actions.size + 3}]}>
      <Pressable testID="ui-card-detail-edit" accessibilityRole="button" accessibilityLabel="생성에서 편집"
        onPress={() => {setMenuOpen(false); onEdit();}} style={styles.menuItem}>
        <Icon name="compose" size={actions.iconSize}/><Text style={styles.menuText}>생성에서 편집</Text>
      </Pressable>
    </View>}
  </View></SwipeBack>;
}

const useStyles = themedStyles(colors => ({
  screen: {flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.background},
  content: {flex: 1, minHeight: 0, overflow: 'hidden'},
  body: {paddingBottom: 32},
  title: {fontWeight: '700', color: colors.foreground, includeFontPadding: false,
    ...(Platform.OS === 'android' ? {fontFamily: 'sans-serif'} : {})},
  creator: {marginTop: 10, fontSize: 14, lineHeight: 22, color: colors.secondaryForeground},
  creatorName: {color: colors.foreground},
  tags: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16},
  tag: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.surface},
  tagText: {fontSize: 13, color: colors.controlForeground},
  sectionHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline'},
  count: {fontSize: 14, color: colors.secondaryForeground},
  gallery: {flexDirection: 'row', flexWrap: 'wrap', borderRadius: 12, overflow: 'hidden'},
  section: {marginTop: 28},
  sectionTitle: {...listTypography, fontWeight: '700', color: colors.foreground, marginBottom: 10},
  paragraph: {...listTypography, lineHeight: 27, color: colors.foreground},
  footer: {paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, backgroundColor: colors.background},
  start: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedBackground},
  startText: {...listTypography, fontWeight: '700', color: colors.selectedForeground},
  floatingButton: {position: 'absolute', zIndex: 2, backgroundColor: colors.background},
  menuDismiss: {...StyleSheet.absoluteFillObject, zIndex: 1},
  menu: {position: 'absolute', zIndex: 3, padding: 6, borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.background},
  menuItem: {minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14},
  menuText: {...listTypography, color: colors.foreground},
}));
