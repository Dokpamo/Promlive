import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react';
import {Animated, BackHandler, FlatList, Keyboard, Platform, Text, View, useWindowDimensions, type CellRendererProps} from 'react-native';
import {useAppearance} from '../features/appearance/AppAppearance';
import {SettingsIcon} from '../features/settings/SettingsIcon';
import {RowPressable} from './RowPressable';
import {PressSurface} from './PressSurface';
import {ItemActionMenu, type ItemMenuTarget} from './ItemActions';
import {ItemRenameSheet} from './ItemRenameSheet';
import {panelReference as g} from './panelGeometry';
import {selectionHaptic} from './selectionHaptic';
import {itemListLayout, useItemPresence, useItemReducedMotion, useItemRowOffset, type ItemLayout, type ListItem} from './itemListMotion';
import type {SheetScrollState} from './sheetMotion';

interface ListActions {
  rename(id: string, title: string): Promise<void>;
  pin(id: string, pinned: boolean): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
}
export interface ListHeaderState {
  selecting: boolean; count: number; cancel: () => void;
  selection: {progress: Animated.Value; present: boolean};
}
interface Props<T extends ListItem> {
  items: readonly T[]; allItems: readonly T[]; selectedId?: string | undefined;
  actions: ListActions; onOpen: (item: T) => void; report: (error: unknown) => void;
  scope: 'history' | 'card'; scale: number; resetKey: string; empty: string; active?: boolean;
  header?: (state: ListHeaderState) => ReactNode;
  leading?: (item: T) => ReactNode;
  geometry?: {rowHeight: number; lineHeight: number; fontSize: number; padding: number; inset: number; radius: number; highlightInset: number};
  scroll?: RefObject<SheetScrollState>; onListTouch?: () => void;
}

/** Card and conversation lists share actions, selection and motion, keeping their own row geometry. */
export function ManagedItemList<T extends ListItem>({items, allItems, selectedId, actions, onOpen, report, scope, scale: s, resetKey, empty, active = true, header, leading, geometry, scroll, onListTouch}: Props<T>) {
  const {colors: c} = useAppearance();
  const panel = useRef<View>(null);
  const menuRow = useRef<View | null>(null);
  const dimensions = useRef({content: 0, viewport: 0});
  const {fontScale} = useWindowDimensions();
  const [menu, setMenu] = useState<ItemMenuTarget | null>(null);
  const [rename, setRename] = useState<T | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletion = useRef(false);
  const reduced = useItemReducedMotion();
  const selection = useItemPresence(selected !== null, reduced);
  const selectionCount = allItems.filter(item => selected?.has(item.id)).length;
  const geo = geometry ?? {rowHeight: g.rowHeight, lineHeight: g.rowLine, fontSize: g.rowFont, padding: g.rowInset, inset: 0, radius: g.controlRadius, highlightInset: g.highlightInset};
  const rowHeight = Math.max(geo.rowHeight, geo.lineHeight * fontScale + 2 * g.rowPadding) * s;
  const rows = useMemo(() => items.length ? itemListLayout(items, rowHeight, 1 + 24 * s) : [], [items, rowHeight, s]);
  const layoutKey = `${resetKey}:${rowHeight}`;
  const footerHeight = 78 * s, footerBottom = 10 * s;
  const overlay = !!menu || !!rename;
  useEffect(() => {if (selected && selectionCount === 0) setSelected(null);}, [selected, selectionCount]);
  useEffect(() => {if (!active) {setSelected(null); setMenu(null); setRename(null);}}, [active]);
  const back = useCallback(() => {
    if (!active || !selected || menu || rename) return false;
    setSelected(null); return true;
  }, [active, menu, rename, selected]);
  useEffect(() => {
    const native = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', back) : undefined;
    if (Platform.OS !== 'web') return () => native?.remove();
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && !event.defaultPrevented && back()) {event.preventDefault(); event.stopImmediatePropagation();}};
    document.addEventListener('keydown', escape, true);
    return () => {native?.remove(); document.removeEventListener('keydown', escape, true);};
  }, [back]);
  const select = (item: T) => {
    if (deletion.current) return;
    if (selected) {
      setSelected(current => {const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next.size ? next : null;});
    } else {Keyboard.dismiss(); onOpen(item);}
  };
  const remove = async (ids: string[]) => {
    if (deletion.current || !ids.length) return;
    deletion.current = true; setDeleting(true);
    try {await actions.remove(ids); setSelected(null);}
    catch (error) {report(error);}
    finally {deletion.current = false; setDeleting(false);}
  };
  const measureMenu = (row: View, accept: (placement: Pick<ItemMenuTarget, 'bounds' | 'anchor'>) => void) => {
    panel.current?.measureInWindow((left, top, width, height) => {
      if (width <= 0 || height <= 0) return;
      row.measureInWindow((rowLeft, rowTop, rowWidth, rowHeight) => {
        if (rowWidth <= 0 || rowHeight <= 0) return;
        accept({bounds: {left, top, width, height}, anchor: {left: rowLeft, top: rowTop, width: rowWidth, height: rowHeight}});
      });
    });
  };
  const openMenu = (item: T, row: View) => {
    if (selected || deletion.current || !active) return;
    Keyboard.dismiss();
    measureMenu(row, placement => {
      menuRow.current = row;
      selectionHaptic();
      setMenu({item, ...placement});
    });
  };
  const measureList = (kind: 'content' | 'viewport', height: number) => {
    dimensions.current[kind] = height;
    if (scroll) scroll.current.canScroll = dimensions.current.content > dimensions.current.viewport + 1;
  };
  return <View ref={panel} collapsable={false} testID={`${scope}-content`} style={{flex: 1}} onLayout={() => {
    if (menu && menuRow.current) measureMenu(menuRow.current, placement => setMenu(current => current ? {...current, ...placement} : null));
  }}>
    <View style={{flex: 1}} pointerEvents={overlay ? 'none' : 'auto'} aria-hidden={overlay} accessibilityElementsHidden={overlay} importantForAccessibility={overlay ? 'no-hide-descendants' : 'auto'}>
      {header?.({selecting: selected !== null, count: selectionCount, cancel: () => setSelected(null), selection})}
      <View style={{flex: 1}} onStartShouldSetResponderCapture={() => {onListTouch?.(); return false;}}>
        <FlatList testID={scope === 'card' ? 'card-list' : 'card-conversation-list'} data={rows} keyExtractor={item => item.key} CellRendererComponent={ItemListCell} style={{flex: 1}} removeClippedSubviews={false}
          contentContainerStyle={{paddingHorizontal: geo.inset * s, paddingBottom: scope === 'card' ? 12 * s : 0}}
          extraData={{selected, selectedId, menu: menu?.item.id}}
          getItemLayout={(_, index) => ({index, length: rows[index]!.height, offset: rows[index]!.top})}
          onLayout={event => measureList('viewport', event.nativeEvent.layout.height)} onContentSizeChange={(_, height) => measureList('content', height)}
          onScroll={event => {if (scroll) scroll.current.offset = Math.max(0, event.nativeEvent.contentOffset.y);}} scrollEventThrottle={16}
          ListFooterComponent={<Animated.View pointerEvents="none" style={{height: selection.progress.interpolate({inputRange: [0, 1], outputRange: [0, footerHeight + footerBottom + 18 * s]})}}/>}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          ListEmptyComponent={<Text style={{paddingHorizontal: geo.padding * s, paddingVertical: 19 * s, color: c.muted, fontSize: 23 * s}}>{empty}</Text>}
          renderItem={({item}) => <ItemMotionCell item={item} resetKey={layoutKey} reduced={reduced} backgroundColor={c.drawer} radius={geo.radius * s}>
            {item.kind === 'divider' ? <ItemPinDivider scope={scope} visible={item.visible} scale={s} inset={geo.padding} reduced={reduced}/> :
              <ItemRow item={item.item} scope={scope} scale={s} height={rowHeight} geometry={geo} leading={leading?.(item.item)} selecting={selected !== null} selectionProgress={selection.progress} reduced={reduced}
                selected={selected ? selected.has(item.item.id) : item.item.id === (menu?.item.id ?? selectedId)} disabled={deleting}
                onPress={() => select(item.item)} onLongPress={row => openMenu(item.item, row)}/>}
          </ItemMotionCell>}/>
      </View>
      <SelectionFooter scope={scope} selection={selection} selected={selected} count={selectionCount} deleting={deleting} scale={s} height={footerHeight} bottom={footerBottom} onDelete={() => {if (selected) void remove([...selected]);}}/>
    </View>
    {menu && <ItemActionMenu target={menu} scale={s} scope={scope} onClose={() => {menuRow.current = null; setMenu(null);}}
      onSelect={() => setSelected(new Set([menu.item.id]))}
      onPin={() => {void actions.pin(menu.item.id, menu.item.pinnedAt == null).catch(report);}}
      onRename={() => setRename(allItems.find(item => item.id === menu.item.id) ?? null)} onDelete={() => {void remove([menu.item.id]);}}/>}
    {rename && <ItemRenameSheet item={rename} scope={scope} onClose={() => setRename(null)} onSave={title => actions.rename(rename.id, title)}/>}
  </View>;
}

function ItemListCell<T extends ListItem>({item, index, children, style, onLayout, onFocusCapture}: CellRendererProps<ItemLayout<T>>) {
  const layer = item.kind === 'item' && item.item.pinnedAt != null ? Math.max(1, 10000 - index) : 0;
  const events = {onLayout, onFocusCapture};
  return <View {...events} style={[style, {zIndex: layer}]}>{children}</View>;
}
function ItemMotionCell<T extends ListItem>({item, resetKey, reduced, backgroundColor, radius, children}: {item: ItemLayout<T>; resetKey: string; reduced: boolean; backgroundColor: string; radius: number; children: ReactNode}) {
  const offset = useItemRowOffset(item.top, resetKey, reduced);
  return <Animated.View style={{height: item.height, overflow: 'visible', backgroundColor: item.kind === 'item' ? backgroundColor : undefined, borderRadius: radius, transform: [{translateY: offset}]}}>{children}</Animated.View>;
}
function ItemPinDivider({scope, visible, scale: s, inset, reduced}: {scope: 'card' | 'history'; visible: boolean; scale: number; inset: number; reduced: boolean}) {
  const {colors: c} = useAppearance();
  const {progress} = useItemPresence(visible, reduced);
  return <Animated.View testID={`${scope}-pin-divider`} pointerEvents="none" accessibilityLabel={visible ? `고정된 ${scope === 'card' ? '카드' : '채팅'} 구분선` : undefined} aria-hidden={!visible} accessibilityElementsHidden={!visible}
    style={{position: 'absolute', left: inset * s, right: inset * s, top: 12 * s, height: 1, backgroundColor: c.divider, opacity: progress,
      transform: [{scaleX: progress.interpolate({inputRange: [0, 1], outputRange: [0.9, 1]})}]}}/>;
}
function ItemRow({item, scope, scale: s, height, geometry, leading, selecting, selectionProgress, reduced, selected, disabled, onPress, onLongPress}: {
  item: ListItem; scope: 'card' | 'history'; scale: number; height: number; geometry: NonNullable<Props<ListItem>['geometry']>; leading?: ReactNode;
  selecting: boolean; selectionProgress: Animated.Value; reduced: boolean; selected: boolean; disabled: boolean; onPress: () => void; onLongPress: (row: View) => void;
}) {
  const {colors: c} = useAppearance();
  const row = useRef<View>(null);
  const openMenu = () => {if (row.current) onLongPress(row.current);};
  const {progress: highlight} = useItemPresence(selected, reduced, true);
  const {progress: pinned} = useItemPresence(item.pinnedAt != null, reduced);
  const pinVisibility = Animated.multiply(pinned, Animated.subtract(1, selectionProgress));
  return <View ref={row} collapsable={false} testID={`sidebar-anchor-${item.id}`}><RowPressable testID={`sidebar-row-${item.id}`} accessibilityRole={selecting ? 'checkbox' : 'button'}
    accessibilityLabel={selecting ? item.title : `${item.title}${scope === 'card' ? ' 카드의 채팅 기록' : ' 채팅 열기'}`} accessibilityHint={selecting ? undefined : '길게 눌러 선택, 고정, 이름 변경, 삭제'}
    accessibilityState={selecting ? {checked: selected, disabled} : {selected, disabled}}
    accessibilityActions={[{name: 'longpress', label: scope === 'card' ? '카드 메뉴' : '채팅내역 메뉴'}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'longpress') openMenu();}}
    selected={selected} selectedHighlight={scope === 'history' || selecting ? 'pressed' : 'full'} selectionProgress={highlight} disabled={disabled} delayLongPress={420}
    onPress={onPress} onLongPress={openMenu} radius={geometry.radius * s} highlightInset={geometry.highlightInset * s}
    contentStyle={{height, paddingHorizontal: geometry.padding * s, flexDirection: 'row', alignItems: 'center'}}>
    <Animated.View pointerEvents="none" accessible={false} aria-hidden style={{width: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [0, 46 * s]}), opacity: selectionProgress, overflow: 'hidden'}}>
      <Animated.View testID={`${scope}-check-${item.id}`} style={{width: 30 * s, height: 30 * s, borderWidth: 1.5 * s, borderColor: c.muted, borderRadius: 15 * s, alignItems: 'center', justifyContent: 'center',
        transform: [{scale: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [0.86, 1]})}]}}>
        <Animated.View style={{opacity: highlight, transform: [{scale: highlight.interpolate({inputRange: [0, 1], outputRange: [0.7, 1]})}]}}><SettingsIcon name="check" size={22 * s} color={c.text}/></Animated.View>
      </Animated.View>
    </Animated.View>
    {leading}
    <Text numberOfLines={1} style={{flex: 1, minWidth: 0, color: c.text, fontSize: geometry.fontSize * s, lineHeight: geometry.lineHeight * s, fontWeight: '400', includeFontPadding: false}}>{item.title}</Text>
    <Animated.View pointerEvents="none" accessible={false} aria-hidden style={{width: pinVisibility.interpolate({inputRange: [0, 1], outputRange: [0, 40 * s]}), alignItems: 'flex-end', opacity: pinVisibility, overflow: 'hidden'}}><SettingsIcon name="pin" size={24 * s} color={c.muted}/></Animated.View>
  </RowPressable></View>;
}
function SelectionFooter({scope, selection, selected, count, deleting, scale: s, height, bottom, onDelete}: {
  scope: 'card' | 'history'; selection: ListHeaderState['selection']; selected: Set<string> | null; count: number; deleting: boolean; scale: number; height: number; bottom: number; onDelete: () => void;
}) {
  const {colors: c, settings: p, isDark} = useAppearance();
  const {fontScale} = useWindowDimensions();
  const lastCount = useRef(count);
  if (count) lastCount.current = count;
  if (!selection.present) return null;
  return <Animated.View testID={`${scope}-selection-footer`} pointerEvents={selected ? 'auto' : 'none'} aria-hidden={!selected} accessibilityElementsHidden={!selected} importantForAccessibility={selected ? 'auto' : 'no-hide-descendants'}
    style={{position: 'absolute', bottom, alignSelf: 'center', width: Math.max(232, 156 * fontScale + 76) * s, maxWidth: '90%', height, opacity: selection.progress,
      transform: [{translateY: selection.progress.interpolate({inputRange: [0, 1], outputRange: [20 * s, 0]})}, {scale: selection.progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
    <PressSurface testID={`${scope}-delete-selected`} accessibilityRole="button" accessibilityLabel={`선택한 ${scope === 'card' ? '카드' : '채팅'} ${count}개 삭제`} accessibilityState={{disabled: !count || deleting}} disabled={!count || deleting}
      onPress={onDelete} radius={g.controlRadius * s} highlightColor={p.selected} style={{flex: 1}}
      contentStyle={{backgroundColor: p.sheet, boxShadow: isDark ? '0px 3px 16px rgba(0,0,0,0.24)' : '0px 3px 16px rgba(0,0,0,0.07)', flexDirection: 'row', gap: 14 * s, alignItems: 'center', justifyContent: 'center'}}>
      <SettingsIcon name="delete" size={30 * s} color={c.error}/><Text numberOfLines={1} style={{color: c.error, fontSize: g.rowFont * s}}>{deleting ? '삭제 중…' : `${count || lastCount.current}개 삭제`}</Text>
    </PressSurface>
  </Animated.View>;
}
