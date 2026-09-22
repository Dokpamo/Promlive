import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject} from 'react';
import {Animated, BackHandler, FlatList, Keyboard, Platform, Text, View, useWindowDimensions, type CellRendererProps} from 'react-native';
import type {ConversationList} from './ConversationList';
import type {Card} from '../cards/model';
import type {Conversation} from './model';
import {CardConversationHeader} from './ChatHistory';
import {useAppearance} from '../appearance/AppAppearance';
import {RowPressable} from '../../layout/RowPressable';
import {SettingsIcon} from '../settings/SettingsIcon';
import {panelReference as g} from '../../layout/panelGeometry';
import {PressSurface} from '../../layout/PressSurface';
import type {SheetScrollState} from '../../layout/sheetMotion';
import {HistoryActionMenu, type HistoryMenuTarget} from './HistoryActions';
import {HistoryRenameSheet} from './HistoryRenameSheet';
import {selectionHaptic} from '../../layout/selectionHaptic';
import {historyListLayout, useHistoryPresence, useHistoryReducedMotion, useHistoryRowOffset, type HistoryLayoutItem} from './historyListMotion';

export function CardConversationPanel({history, openConversation, report, scale: s, card, search, close, onClose, scroll, onListTouch}: {
  history: ConversationList; openConversation: (conversation: Conversation) => Promise<void>; report: (error: unknown) => void; scale: number; card: Card; search: string;
  close: () => void; onClose: () => void; scroll: RefObject<SheetScrollState>; onListTouch: () => void;
}) {
  useSyncExternalStore(history.subscribe, history.snapshot);
  const {colors: c, settings: p, isDark} = useAppearance();
  const panel = useRef<View>(null);
  const dimensions = useRef({content: 0, viewport: 0});
  const {fontScale} = useWindowDimensions();
  const [menu, setMenu] = useState<HistoryMenuTarget | null>(null);
  const [rename, setRename] = useState<Conversation | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletion = useRef(false);
  const query = search.trim().toLocaleLowerCase();
  const conversations = useMemo(() => history.items.filter(item => item.cardId === card.id && `${item.title} ${item.preview ?? ''}`.toLocaleLowerCase().includes(query)), [history.items, card.id, query]);
  const selectionCount = history.items.filter(item => selected?.has(item.id)).length;
  const reduced = useHistoryReducedMotion();
  const selection = useHistoryPresence(selected !== null, reduced);
  const lastSelectionCount = useRef(selectionCount);
  if (selectionCount) lastSelectionCount.current = selectionCount;
  const rowHeight = Math.max(g.rowHeight, g.rowLine * fontScale + 2 * g.rowPadding) * s;
  const dividerHeight = 1 + 24 * s;
  const rows = useMemo(() => conversations.length ? historyListLayout(conversations, rowHeight, dividerHeight) : [], [conversations, rowHeight, dividerHeight]);
  const layoutKey = `${card.id}:${query}:${rowHeight}`;
  const footerHeight = 78 * s;
  const footerBottom = 10 * s;
  // Room for a three-digit count, the label and icon; follow system text scaling.
  const footerWidth = Math.max(232, 156 * fontScale + 76) * s;
  const overlay = !!menu || !!rename;
  useEffect(() => {
    if (selected && selectionCount === 0) setSelected(null);
  }, [selected, selectionCount]);
  const back = useCallback(() => {
    if (!selected || menu || rename) return false;
    setSelected(null); return true;
  }, [menu, rename, selected]);
  useEffect(() => {
    const native = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', back) : undefined;
    if (Platform.OS !== 'web') return () => native?.remove();
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && !event.defaultPrevented && back()) {event.preventDefault(); event.stopImmediatePropagation();}};
    document.addEventListener('keydown', escape, true);
    return () => {native?.remove(); document.removeEventListener('keydown', escape, true);};
  }, [back]);
  const select = (item: Conversation) => {
    if (deletion.current) return;
    if (selected) {
      setSelected(current => {const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next.size ? next : null;});
    } else {
      Keyboard.dismiss();
      void openConversation(item).then(close).catch(report);
    }
  };
  const remove = async (ids: string[]) => {
    if (deletion.current || !ids.length) return;
    deletion.current = true; setDeleting(true);
    try {await history.remove(ids); setSelected(null);}
    catch (error) {report(error);}
    finally {deletion.current = false; setDeleting(false);}
  };
  const openMenu = (item: Conversation) => {
    if (selected || deletion.current) return;
    Keyboard.dismiss();
    panel.current?.measureInWindow((left, top, width, height) => {
      if (width <= 0 || height <= 0) return;
      selectionHaptic();
      setMenu({conversation: item, bounds: {left, top, width, height}});
    });
  };
  const measureList = (kind: 'content' | 'viewport', height: number) => {
    dimensions.current[kind] = height;
    scroll.current.canScroll = dimensions.current.content > dimensions.current.viewport + 1;
  };
  return <View ref={panel} collapsable={false} testID="history-content" style={{flex: 1}} onLayout={() => {
    if (menu) panel.current?.measureInWindow((left, top, width, height) => {
      if (width > 0 && height > 0) setMenu(current => current ? {...current, bounds: {left, top, width, height}} : null);
    });
  }}>
    <View style={{flex: 1}} pointerEvents={overlay ? 'none' : 'auto'} aria-hidden={overlay} accessibilityElementsHidden={overlay} importantForAccessibility={overlay ? 'no-hide-descendants' : 'auto'}>
      <CardConversationHeader card={card} scale={s} onClose={() => {if (selected) setSelected(null); else onClose();}} closeLabel={selected ? '선택 취소' : '채팅내역 닫기'}/>
      <View style={{flex: 1}} onStartShouldSetResponderCapture={() => {onListTouch(); return false;}}>
        <FlatList testID="card-conversation-list" data={rows} keyExtractor={item => item.key} CellRendererComponent={HistoryListCell} style={{flex: 1}} removeClippedSubviews={false}
          extraData={{selected, current: history.selected?.id, menu: menu?.conversation.id}}
          getItemLayout={(_, index) => ({index, length: rows[index]!.height, offset: rows[index]!.top})}
          onLayout={event => measureList('viewport', event.nativeEvent.layout.height)} onContentSizeChange={(_, height) => measureList('content', height)}
          onScroll={event => {scroll.current.offset = Math.max(0, event.nativeEvent.contentOffset.y);}} scrollEventThrottle={16}
          ListFooterComponent={<Animated.View pointerEvents="none" style={{height: selection.progress.interpolate({inputRange: [0, 1], outputRange: [0, footerHeight + footerBottom + 18 * s]})}}/>}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          ListEmptyComponent={<Text style={{paddingHorizontal: g.rowInset * s, paddingVertical: 19 * s, color: c.muted, fontSize: 23 * s}}>{query ? '검색 결과가 없어요.' : '아직 채팅이 없어요.'}</Text>}
          renderItem={({item}) => <HistoryMotionCell item={item} resetKey={layoutKey} reduced={reduced} backgroundColor={c.drawer} radius={g.controlRadius * s}>
            {item.kind === 'divider' ? <HistoryPinDivider visible={item.visible} scale={s} reduced={reduced}/> :
              <HistoryRow item={item.conversation} scale={s} height={rowHeight} selecting={selected !== null} selectionProgress={selection.progress} reduced={reduced}
                selected={selected ? selected.has(item.conversation.id) : item.conversation.id === (menu?.conversation.id ?? history.selected?.id)} disabled={deleting}
                onPress={() => select(item.conversation)} onLongPress={() => openMenu(item.conversation)}/>}
          </HistoryMotionCell>}/>
      </View>
      {selection.present && <Animated.View testID="history-selection-footer" pointerEvents={selected ? 'auto' : 'none'} aria-hidden={!selected} accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}
        style={{position: 'absolute', bottom: footerBottom, alignSelf: 'center', width: footerWidth, maxWidth: '90%', height: footerHeight, opacity: selection.progress,
          transform: [{translateY: selection.progress.interpolate({inputRange: [0, 1], outputRange: [20 * s, 0]})}, {scale: selection.progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
      <PressSurface testID="history-delete-selected" accessibilityRole="button" accessibilityLabel={`선택한 채팅 ${selectionCount}개 삭제`} accessibilityState={{disabled: !selectionCount || deleting}} disabled={deleting}
        onPress={() => {if (selected) void remove([...selected]);}} radius={g.controlRadius * s} highlightColor={p.selected}
        style={{flex: 1}}
        contentStyle={{backgroundColor: p.sheet, boxShadow: isDark ? '0px 3px 16px rgba(0,0,0,0.24)' : '0px 3px 16px rgba(0,0,0,0.07)', flexDirection: 'row', gap: 14 * s, alignItems: 'center', justifyContent: 'center'}}>
        <SettingsIcon name="delete" size={30 * s} color={c.error}/><Text numberOfLines={1} style={{color: c.error, fontSize: g.rowFont * s}}>{deleting ? '삭제 중…' : `${selectionCount || lastSelectionCount.current}개 삭제`}</Text>
      </PressSurface></Animated.View>}
    </View>
    {menu && <HistoryActionMenu target={menu} scale={s} onClose={() => setMenu(null)}
      onSelect={() => setSelected(new Set([menu.conversation.id]))}
      onPin={() => {void history.pin(menu.conversation.id, menu.conversation.pinnedAt == null).catch(report);}}
      onRename={() => setRename(menu.conversation)} onDelete={() => {void remove([menu.conversation.id]);}}/>}
    {rename && <HistoryRenameSheet conversation={rename} onClose={() => setRename(null)} onSave={title => history.rename(rename.id, title)}/>}
  </View>;
}

function HistoryListCell({item, index, children, style, onLayout, onFocusCapture}: CellRendererProps<HistoryLayoutItem>) {
  // A newly pinned row travels over the rows making room for it, without mixing text.
  const layer = item.kind === 'conversation' && item.conversation.pinnedAt != null ? Math.max(1, 10000 - index) : 0;
  const events = {onLayout, onFocusCapture};
  return <View {...events} style={[style, {zIndex: layer}]}>{children}</View>;
}

function HistoryMotionCell({item, resetKey, reduced, backgroundColor, radius, children}: {item: HistoryLayoutItem; resetKey: string; reduced: boolean; backgroundColor: string; radius: number; children: ReactNode}) {
  const offset = useHistoryRowOffset(item.top, resetKey, reduced);
  return <Animated.View style={{height: item.height, overflow: 'visible', backgroundColor: item.kind === 'conversation' ? backgroundColor : undefined, borderRadius: radius, transform: [{translateY: offset}]}}>{children}</Animated.View>;
}

function HistoryPinDivider({visible, scale: s, reduced}: {visible: boolean; scale: number; reduced: boolean}) {
  const {colors: c} = useAppearance();
  const {progress} = useHistoryPresence(visible, reduced);
  return <Animated.View testID="history-pin-divider" pointerEvents="none" accessibilityLabel={visible ? '고정된 채팅 구분선' : undefined} aria-hidden={!visible} accessibilityElementsHidden={!visible}
    style={{position: 'absolute', left: g.rowInset * s, right: g.rowInset * s, top: 12 * s, height: 1, backgroundColor: c.divider, opacity: progress,
      transform: [{scaleX: progress.interpolate({inputRange: [0, 1], outputRange: [0.9, 1]})}]}}/>;
}

function HistoryRow({item, scale: s, height, selecting, selectionProgress, reduced, selected, disabled, onPress, onLongPress}: {
  item: Conversation; scale: number; height: number; selecting: boolean; selectionProgress: Animated.Value; reduced: boolean; selected: boolean; disabled: boolean;
  onPress: () => void; onLongPress: () => void;
}) {
  const {colors: c} = useAppearance();
  const {progress: highlight} = useHistoryPresence(selected, reduced, true);
  const {progress: pinned} = useHistoryPresence(item.pinnedAt != null, reduced);
  const pinVisibility = Animated.multiply(pinned, Animated.subtract(1, selectionProgress));
  return <View>
    <RowPressable testID={`sidebar-row-${item.id}`} accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityLabel={selecting ? item.title : `${item.title} 채팅 열기`} accessibilityHint={selecting ? undefined : '길게 눌러 선택, 고정, 이름 변경, 삭제'}
      accessibilityState={selecting ? {checked: selected, disabled} : {selected, disabled}}
      accessibilityActions={[{name: 'longpress', label: '채팅내역 메뉴'}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'longpress') onLongPress();}}
      selected={selected} selectedHighlight="pressed" selectionProgress={highlight} disabled={disabled} delayLongPress={420}
      onPress={onPress} onLongPress={onLongPress} radius={g.controlRadius * s} highlightInset={g.highlightInset * s}
      contentStyle={{height, paddingVertical: g.rowPadding * s, paddingHorizontal: g.rowInset * s, flexDirection: 'row', alignItems: 'center'}}>
      <Animated.View pointerEvents="none" accessible={false} aria-hidden style={{width: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [0, 46 * s]}), opacity: selectionProgress, overflow: 'hidden'}}>
        <Animated.View testID={`history-check-${item.id}`} style={{width: 30 * s, height: 30 * s, borderWidth: 1.5 * s, borderColor: c.muted, borderRadius: 15 * s, alignItems: 'center', justifyContent: 'center',
          transform: [{scale: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [0.86, 1]})}]}}>
          <Animated.View style={{opacity: highlight, transform: [{scale: highlight.interpolate({inputRange: [0, 1], outputRange: [0.7, 1]})}]}}><SettingsIcon name="check" size={22 * s} color={c.text}/></Animated.View>
        </Animated.View>
      </Animated.View>
      <Text numberOfLines={1} style={{flex: 1, minWidth: 0, color: c.text, fontSize: g.rowFont * s, lineHeight: g.rowLine * s, fontWeight: '400', includeFontPadding: false}}>{item.title}</Text>
      <Animated.View pointerEvents="none" accessible={false} aria-hidden style={{width: pinVisibility.interpolate({inputRange: [0, 1], outputRange: [0, 40 * s]}), alignItems: 'flex-end', opacity: pinVisibility, overflow: 'hidden'}}><SettingsIcon name="pin" size={24 * s} color={c.muted}/></Animated.View>
    </RowPressable>
  </View>;
}
