import {useRef, useState} from 'react';
import {Animated, Platform, Pressable, Text, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Card} from '../cards/model';
import type {CardListActions} from '../cards/store';
import {CardList} from '../cards/CardList';
import {CardThumbnail} from '../cards/CardThumbnail';
import {ChatIcon} from './ChatIcon';
import {referenceSidebar as r} from './chatAppearance';
import {referenceHeader, referenceTypography} from '../../layout/metrics';
import {HeaderButton} from '../../layout/ScreenHeader';
import {PressSurface} from '../../layout/PressSurface';
import {useAppearance} from '../appearance/AppAppearance';
import {DrawerGestureBoundary} from './DrawerGestureBoundary';
import {usePressFeedback} from '../../layout/usePressFeedback';
import {rowPressedScale, RowPressable} from '../../layout/RowPressable';
import {panelReference} from '../../layout/panelGeometry';
import {UserAvatar} from '../profile/UserAvatar';
import {useUserProfile} from '../profile/UserProfileContext';

interface Props {
  cards: readonly Card[];
  cardActions: CardListActions;
  active: boolean;
  selectedCardId: string | undefined;
  startChat: (card?: Card) => Promise<void>;
  report: (error: unknown) => void;
  width: number;
  historyCard: Card | undefined;
  historyProgress: Animated.AnimatedInterpolation<number>;
  historySearch: string;
  onHistorySearch: (value: string) => void;
  openCard: (card: Card) => void;
  close: () => void;
  openSettings: () => void;
}

/** Shared search/create controls stay above the card history popup. */
export function ChatHistory({cards: allCards, cardActions, active, selectedCardId, startChat, report, width, historyCard, historyProgress, historySearch, onHistorySearch, openCard, close, openSettings}: Props) {
  const {colors: c} = useAppearance();
  const {value: profile} = useUserProfile();
  const [cardSearch, setCardSearch] = useState('');
  const insets = useSafeAreaInsets();
  const s = width / r.width;
  const query = cardSearch.trim().toLocaleLowerCase();
  const cards = allCards.filter(item => !item.archived && `${item.title} ${item.description}`.toLocaleLowerCase().includes(query));
  const listTop = (r.searchTop + r.searchHeight + r.listGap) * s;
  const start = async () => {
    await startChat(historyCard);
    close();
  };

  return <View testID="card-list-page" style={{flex: 1, backgroundColor: c.drawer, paddingTop: insets.top, paddingBottom: insets.bottom}}>
    <View style={{height: listTop, flexShrink: 0}}>
      <View style={{position: 'absolute', left: r.textInset * s, top: r.headerTop * s, right: 28 * s, height: r.headerHeight * s, justifyContent: 'center'}}>
        <Text accessibilityRole="header" numberOfLines={1} style={{color: c.brand, fontSize: r.brandFontSize * s, lineHeight: r.brandLineHeight * s, fontWeight: referenceTypography.logoWeight, letterSpacing: -s, includeFontPadding: false}}>Promlive</Text>
      </View>
      <View testID="sidebar-toolbar" style={{position: 'absolute', left: r.searchLeft * s, top: r.searchTop * s, width: r.searchWidth * s, height: r.searchHeight * s, flexDirection: 'row', alignItems: 'center', gap: r.searchActionGap * s}}>
        <View style={{flex: 1, minWidth: 0}}>
          <DrawerGestureBoundary><SidebarSearch scale={s} history={!!historyCard} historyProgress={historyProgress} value={historyCard ? historySearch : cardSearch} onChange={historyCard ? onHistorySearch : setCardSearch}/></DrawerGestureBoundary>
        </View>
        <CreateChatButton scale={s} label={historyCard ? `${historyCard.title}에서 새 채팅` : '새 채팅'} onPress={() => {void start().catch(report);}}/>
      </View>
    </View>
    <View style={{flex: 1}} pointerEvents={historyCard ? 'none' : 'auto'} aria-hidden={!!historyCard} accessibilityElementsHidden={!!historyCard} importantForAccessibility={historyCard ? 'no-hide-descendants' : 'auto'}>
      <CardList cards={cards} allCards={allCards} actions={cardActions} active={active && !historyCard} scale={s} selectedId={selectedCardId}
        search={query} openCard={openCard} report={report}/>
    </View>
    <View testID="sidebar-footer" style={{height: (r.footerHeight + r.footerBottom) * s, flexShrink: 0}}>
      <RowPressable testID="sidebar-account" accessibilityRole="button" accessibilityLabel="사용자 계정" accessibilityHint="설정 열기" onPress={openSettings} radius={r.rowRadius * s} style={{position: 'absolute', left: r.rowInset * s, right: r.rowInset * s, top: 0, height: r.footerHeight * s}} contentStyle={{height: '100%', paddingHorizontal: (r.accountAvatarLeft - r.rowInset) * s, flexDirection: 'row', alignItems: 'center'}}>
        <UserAvatar testID="sidebar-user-avatar" image={profile.image} size={r.avatar * s}/>
        <Text numberOfLines={1} style={{flex: 1, marginLeft: (r.accountNameLeft - r.accountAvatarLeft - r.avatar) * s, color: c.text, fontSize: 26 * s, lineHeight: 35 * s, fontWeight: '600', includeFontPadding: false}}>{profile.name}</Text>
      </RowPressable>
    </View>
  </View>;
}

export function CardConversationHeader({card, scale: s, onClose, closeLabel = '채팅내역 닫기'}: {card: Card; scale: number; onClose: () => void; closeLabel?: string}) {
  const {colors: c} = useAppearance();
  // Center the circular close button on the popup's outer corner arc.
  const inset = panelReference.radius - referenceHeader.height / 2;
  const top = inset - panelReference.groupPadding;
  const bottom = panelReference.rowHeight + panelReference.groupPadding - referenceHeader.height - top;
  return <View testID="card-history-header" style={{height: referenceHeader.height * s, flexShrink: 0, marginTop: top * s, marginBottom: bottom * s, paddingLeft: panelReference.rowInset * s, paddingRight: inset * s, flexDirection: 'row', alignItems: 'center', gap: r.cardImageGap * s}}>
    <CardThumbnail testID="card-history-image" cover={card.cover} size={r.cardImage * s}/>
    <Text testID="card-history-title" accessibilityRole="header" numberOfLines={1} style={{flex: 1, minWidth: 0, color: c.text, fontSize: panelReference.rowFont * s, lineHeight: panelReference.rowLine * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{card.title}</Text>
    <HeaderButton width={r.viewportWidth * s} testID="card-history-close" icon="close" label={closeLabel} onPress={onClose} variant="plain"/>
  </View>;
}

export function SidebarSearch({scale: s, history, historyProgress, value, onChange}: {scale: number; history: boolean; historyProgress: Animated.AnimatedInterpolation<number>; value: string; onChange: (value: string) => void}) {
  const {colors: c, settings: p, isDark} = useAppearance();
  const input = useRef<TextInput>(null);
  const {progress, onPressIn, onPressOut} = usePressFeedback();
  const size = r.searchHeight * s;
  const labelTravel = 144 * s;
  // The input keeps its native selection gestures; only its visual surface reacts.
  const mouseFeedback = Platform.OS === 'web' ? {onMouseDown: onPressIn, onMouseUp: onPressOut, onMouseLeave: onPressOut} : {};
  return <Pressable testID={history ? 'history-search' : 'sidebar-search'} accessible={false} onPress={() => input.current?.focus()} onPressIn={onPressIn} onPressOut={onPressOut} style={{height: size}}>
    <Animated.View testID="sidebar-search-surface" style={{height: size, borderRadius: size / 2, backgroundColor: c.search, borderWidth: isDark ? s : 0, borderColor: c.border, boxShadow: isDark ? undefined : '0px 6px 24px rgba(0, 0, 0, 0.035)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 27 * s, gap: 14 * s, transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, rowPressedScale]})}]}}>
      <Animated.View testID="sidebar-search-tint" pointerEvents="none" style={{position: 'absolute', inset: 0, borderRadius: size / 2, backgroundColor: p.selected, opacity: progress}}/>
      <ChatIcon name="search" size={29 * s} color={c.text}/>
      <View style={{flex: 1, minWidth: 0, height: size, overflow: 'hidden'}}>
        {/* Keep one native input for focus/selection; only the empty-field labels move.
            The popup's own progress also reverses these labels during a back drag. */}
        <TextInput ref={input} testID={history ? 'history-search-input' : 'sidebar-search-input'} accessibilityLabel={history ? '이 카드의 채팅 검색' : '카드 검색'} value={value} onChangeText={onChange} selectionColor="#3096EB" underlineColorAndroid="transparent" returnKeyType="search" onTouchStart={onPressIn} onTouchEnd={onPressOut} onTouchCancel={onPressOut} onBlur={onPressOut} {...mouseFeedback} style={{width: '100%', padding: 0, color: c.text, height: size, fontSize: 27 * s, includeFontPadding: false}}/>
        <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position: 'absolute', inset: 0, opacity: value ? 0 : 1}}>
          <Animated.View testID="search-card-placeholder" style={{position: 'absolute', inset: 0, justifyContent: 'center', opacity: historyProgress.interpolate({inputRange: [0, 0.8, 1], outputRange: [1, 0, 0]}), transform: [{translateX: historyProgress.interpolate({inputRange: [0, 1], outputRange: [0, labelTravel]})}]}}>
            <Text numberOfLines={1} style={{color: c.placeholder, fontSize: 27 * s, includeFontPadding: false}}>검색</Text>
          </Animated.View>
          <Animated.View testID="search-history-placeholder" style={{position: 'absolute', inset: 0, justifyContent: 'center', opacity: historyProgress.interpolate({inputRange: [0, 0.2, 1], outputRange: [0, 0, 1]}), transform: [{translateX: historyProgress.interpolate({inputRange: [0, 1], outputRange: [-labelTravel, 0]})}]}}>
            <Text numberOfLines={1} style={{color: c.placeholder, fontSize: 27 * s, includeFontPadding: false}}>채팅 검색</Text>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  </Pressable>;
}

export function CreateChatButton({scale: s, label, onPress, testID = 'sidebar-create'}: {scale: number; label: string; onPress: () => void; testID?: string}) {
  const {colors: c, settings: p, isDark} = useAppearance();
  const size = r.searchHeight * s;
  return <PressSurface compact testID={testID} surfaceTestID="sidebar-create-surface" highlightTestID="sidebar-create-tint" accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    radius={size / 2} highlightColor={p.selected} style={{width: size, height: size, flexShrink: 0}}
    contentStyle={{backgroundColor: c.header, boxShadow: isDark ? undefined : '0px 6px 24px rgba(0, 0, 0, 0.035)', alignItems: 'center', justifyContent: 'center'}}>
    <ChatIcon name="new-chat" size={35 * s} color={c.text}/>
    <View pointerEvents="none" style={{position: 'absolute', inset: 0, borderRadius: size / 2, borderWidth: s, borderColor: c.headerBorder}}/>
  </PressSurface>;
}
