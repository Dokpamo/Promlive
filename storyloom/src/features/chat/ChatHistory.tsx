import {useRef, useState, type RefObject} from 'react';
import {Animated, FlatList, Keyboard, Pressable, Text, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Workspace} from '../../app/workspace';
import type {Card} from '../cards/model';
import {CardThumbnail} from '../cards/CardThumbnail';
import {ChatIcon} from './ChatIcon';
import {referenceSidebar as r, referenceTypography} from './chatAppearance';
import {HeaderButton} from '../../layout/ScreenHeader';
import {useAppearance} from '../appearance/AppAppearance';
import {DrawerGestureBoundary} from './DrawerGestureBoundary';
import {usePressFeedback} from '../../layout/usePressFeedback';
import type {SheetScrollState} from '../settings/sheetMotion';
import {SettingsPressable} from '../settings/SettingsPressable';
import {settingsReference} from '../settings/settingsGeometry';

interface Props {
  workspace: Workspace;
  width: number;
  historyCard: Card | undefined;
  historySearch: string;
  onHistorySearch: (value: string) => void;
  openCard: (card: Card) => void;
  close: () => void;
  openSettings: () => void;
}

/** Brand, contextual search/create controls and account stay outside the history popup. */
export function ChatHistory({workspace: w, width, historyCard, historySearch, onHistorySearch, openCard, close, openSettings}: Props) {
  const {colors: c, isDark} = useAppearance();
  const [cardSearch, setCardSearch] = useState('');
  const insets = useSafeAreaInsets();
  const s = width / r.width;
  const query = cardSearch.trim().toLocaleLowerCase();
  const cards = w.cards.filter(item => !item.archived && `${item.title} ${item.description}`.toLocaleLowerCase().includes(query));
  const shadow = isDark ? undefined : '0px 6px 24px rgba(0, 0, 0, 0.035)';
  const listTop = (r.searchTop + r.searchHeight + r.listGap) * s;
  const start = async () => {
    if (historyCard) await w.startChat(historyCard, true);
    else await w.newGeneralChat();
    close();
  };

  return <View testID="card-list-page" style={{flex: 1, backgroundColor: c.drawer, paddingTop: insets.top, paddingBottom: insets.bottom}}>
    <View style={{height: listTop, flexShrink: 0}}>
      <View style={{position: 'absolute', left: r.textInset * s, top: r.headerTop * s, right: 28 * s, height: r.headerHeight * s, justifyContent: 'center'}}>
        <Text accessibilityRole="header" numberOfLines={1} style={{color: c.brand, fontSize: r.brandFontSize * s, lineHeight: r.brandLineHeight * s, fontWeight: '800', letterSpacing: -s, includeFontPadding: false}}>Promlive</Text>
      </View>
      <View testID="sidebar-toolbar" style={{position: 'absolute', left: r.searchLeft * s, top: r.searchTop * s, width: r.searchWidth * s, height: r.searchHeight * s, flexDirection: 'row', alignItems: 'center', gap: r.searchActionGap * s}}>
        <View style={{flex: 1, minWidth: 0}}>
          <DrawerGestureBoundary><View testID="sidebar-search" style={{height: r.searchHeight * s, borderRadius: r.searchHeight * s / 2, backgroundColor: c.search, borderWidth: isDark ? s : 0, borderColor: c.border, boxShadow: shadow, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 27 * s, gap: 14 * s}}>
            <ChatIcon name="search" size={29 * s} color={c.text}/>
            <TextInput testID="sidebar-search-input" accessibilityLabel={historyCard ? '이 카드의 채팅 검색' : '카드 검색'} value={historyCard ? historySearch : cardSearch} onChangeText={historyCard ? onHistorySearch : setCardSearch} placeholder={historyCard ? '채팅 검색' : '검색'} placeholderTextColor={c.placeholder} selectionColor="#3096EB" underlineColorAndroid="transparent" returnKeyType="search" style={{flex: 1, minWidth: 0, padding: 0, color: c.text, height: r.searchHeight * s, fontSize: 27 * s, includeFontPadding: false}}/>
          </View></DrawerGestureBoundary>
        </View>
        <CreateChatButton scale={s} label={historyCard ? `${historyCard.title}에서 새 채팅` : '새 채팅'} onPress={() => {void start().catch(error => w.report(error));}}/>
      </View>
    </View>
    <View style={{flex: 1}} pointerEvents={historyCard ? 'none' : 'auto'} aria-hidden={!!historyCard} accessibilityElementsHidden={!!historyCard} importantForAccessibility={historyCard ? 'no-hide-descendants' : 'auto'}>
      <SidebarRows items={cards} scale={s} selectedId={historyCard?.id ?? w.conversation?.cardId} testID="card-list" label={title => `${title} 카드의 채팅 기록`} empty={query ? '검색 결과가 없어요.' : '아직 카드가 없어요.'} onSelect={id => {
        Keyboard.dismiss();
        const card = cards.find(item => item.id === id);
        if (card) openCard(card);
      }}/>
    </View>
    <View testID="sidebar-footer" style={{height: (r.footerHeight + r.footerBottom) * s, flexShrink: 0}}>
      <Pressable testID="sidebar-account" accessibilityRole="button" accessibilityLabel="사용자 계정" accessibilityHint="설정 열기" onPress={openSettings} style={({pressed}) => ({position: 'absolute', left: r.rowInset * s, right: r.rowInset * s, top: 0, height: r.footerHeight * s, paddingHorizontal: (r.accountAvatarLeft - r.rowInset) * s, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.6 : 1})}>
        <View accessible={false} style={{width: r.avatar * s, height: r.avatar * s, borderRadius: r.avatar * s / 2, backgroundColor: '#000000'}}/>
        <Text numberOfLines={1} style={{flex: 1, marginLeft: (r.accountNameLeft - r.accountAvatarLeft - r.avatar) * s, color: c.text, fontSize: 26 * s, lineHeight: 35 * s, fontWeight: '600', includeFontPadding: false}}>사용자</Text>
      </Pressable>
    </View>
  </View>;
}

export function CardConversationHeader({card, scale: s, onClose}: {card: Card; scale: number; onClose: () => void}) {
  const {colors: c} = useAppearance();
  return <View testID="card-history-header" style={{height: settingsReference.rowHeight * s, flexShrink: 0, marginBottom: settingsReference.groupPadding * s, paddingLeft: settingsReference.rowInset * s, paddingRight: settingsReference.highlightInset * s, flexDirection: 'row', alignItems: 'center', gap: r.cardImageGap * s}}>
    <CardThumbnail testID="card-history-image" cover={card.cover} size={r.cardImage * s}/>
    <Text testID="card-history-title" accessibilityRole="header" numberOfLines={1} style={{flex: 1, minWidth: 0, color: c.text, fontSize: settingsReference.rowFont * s, lineHeight: settingsReference.rowLine * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{card.title}</Text>
    <HeaderButton width={r.viewportWidth * s} testID="card-history-close" icon="close" label="채팅내역 닫기" onPress={onClose} grouped/>
  </View>;
}

export function CardConversationList({workspace: w, scale, card, search, close, scroll}: {workspace: Workspace; scale: number; card: Card; search: string; close: () => void; scroll: RefObject<SheetScrollState>}) {
  const query = search.trim().toLocaleLowerCase();
  const conversations = w.conversations.filter(item => item.cardId === card.id && `${item.title} ${item.preview ?? ''}`.toLocaleLowerCase().includes(query));
  const select = async (id: string) => {
    Keyboard.dismiss();
    const conversation = conversations.find(item => item.id === id);
    if (conversation) {await w.openConversation(conversation); close();}
  };
  return <SidebarRows items={conversations} scale={scale} variant="history" selectedId={w.conversation?.id} testID="card-conversation-list" label={title => `${title} 채팅 열기`} empty={query ? '검색 결과가 없어요.' : '아직 채팅이 없어요.'} scroll={scroll} onSelect={id => {void select(id).catch(error => w.report(error));}}/>;
}

function SidebarRows({items, scale: s, variant = 'cards', selectedId, testID, label, empty, onSelect, scroll}: {
  items: {id: string; title: string; cover?: Card['cover']}[];
  scale: number;
  variant?: 'cards' | 'history';
  selectedId: string | undefined;
  testID: string;
  label: (title: string) => string;
  empty: string;
  onSelect: (id: string) => void;
  scroll?: RefObject<SheetScrollState>;
}) {
  const {colors: c} = useAppearance();
  const history = variant === 'history';
  const listInset = history ? 0 : r.rowInset * s;
  const contentInset = (history ? settingsReference.rowInset : r.textInset - r.rowInset) * s;
  const highlightRadius = (history ? settingsReference.controlRadius : r.rowRadius) * s;
  const dimensions = useRef({content: 0, viewport: 0});
  const measure = (kind: 'content' | 'viewport', height: number) => {
    dimensions.current[kind] = height;
    if (scroll) scroll.current.canScroll = dimensions.current.content > dimensions.current.viewport + 1;
  };
  return <FlatList testID={testID} data={items} keyExtractor={item => item.id} style={{flex: 1}}
    onLayout={event => measure('viewport', event.nativeEvent.layout.height)} onContentSizeChange={(_, height) => measure('content', height)}
    onScroll={event => {if (scroll) scroll.current.offset = Math.max(0, event.nativeEvent.contentOffset.y);}} scrollEventThrottle={16}
    contentContainerStyle={{paddingHorizontal: listInset, paddingBottom: history ? 0 : 12 * s}}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
    ListEmptyComponent={<Text style={{paddingVertical: 19 * s, paddingHorizontal: contentInset, color: c.muted, fontSize: 23 * s, lineHeight: 34 * s}}>{empty}</Text>}
    renderItem={({item}) => <SettingsPressable testID={`sidebar-row-${item.id}`} accessibilityRole="button" accessibilityLabel={label(item.title)} accessibilityState={{selected: item.id === selectedId}} selected={item.id === selectedId} selectedHighlight={history ? 'pressed' : 'full'} radius={highlightRadius} highlightInset={history ? settingsReference.highlightInset * s : 0} onPress={() => onSelect(item.id)} style={history ? undefined : {height: r.rowHeight * s}} contentStyle={{...(history ? {minHeight: settingsReference.rowHeight * s, paddingVertical: settingsReference.rowPadding * s, justifyContent: 'center'} : {height: '100%', flexDirection: 'row', alignItems: 'center', gap: r.cardImageGap * s}), paddingHorizontal: contentInset}}>
      {!history && item.cover && <CardThumbnail testID={`sidebar-card-image-${item.id}`} cover={item.cover} size={r.cardImage * s}/>}
      <Text numberOfLines={1} style={{...(!history ? {flex: 1, minWidth: 0} : {}), color: c.text, fontSize: (history ? settingsReference.rowFont : r.fontSize) * s, lineHeight: (history ? settingsReference.rowLine : r.lineHeight) * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{item.title}</Text>
    </SettingsPressable>}/>;
}

function CreateChatButton({scale: s, label, onPress}: {scale: number; label: string; onPress: () => void}) {
  const {colors: c, isDark} = useAppearance();
  const {progress, onPressIn, onPressOut} = usePressFeedback();
  const size = r.searchHeight * s;
  return <Pressable testID="sidebar-create" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={{width: size, height: size, flexShrink: 0}}>
    <Animated.View style={{flex: 1, borderRadius: size / 2, backgroundColor: c.search, boxShadow: isDark ? undefined : '0px 6px 24px rgba(0, 0, 0, 0.035)', alignItems: 'center', justifyContent: 'center', transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [1, 0.98]})}]}}>
      <Animated.View pointerEvents="none" style={{position: 'absolute', inset: 4 * s, borderRadius: size / 2, backgroundColor: c.headerPressed, opacity: progress}}/>
      <ChatIcon name="new-chat" size={35 * s} color={c.text}/>
    </Animated.View>
  </Pressable>;
}
