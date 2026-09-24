import {useCallback, useEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {Animated, BackHandler, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type CellRendererProps, type GestureResponderEvent} from 'react-native';
import type {MenuPoint} from './itemMenuGeometry';
import {useAppearance} from '../features/appearance/AppAppearance';
import {SettingsIcon} from '../features/settings/SettingsIcon';
import {RowPressable} from './RowPressable';
import {AnchoredActionMenu, type ItemMenuTarget} from './ItemActions';
import {ItemRenameSheet} from './ItemRenameSheet';
import {referenceHeader} from './metrics';
import {referenceSidebar} from '../features/chat/chatAppearance';
import {panelReference as g} from './panelGeometry';
import {selectionHaptic} from './selectionHaptic';
import {itemListLayout, useItemPresence, useItemReducedMotion, useItemRowOffset, type ItemLayout, type ListItem} from './itemListMotion';
import type {SheetScrollState} from './sheetMotion';
import type {FolderLibrary, FolderRemoval} from '../features/library/FolderLibrary';
import {folderPath} from '../features/library/folderTree';
import {FolderBreadcrumbs} from '../features/library/FolderBreadcrumbs';
import {LibraryFolderSheet} from '../features/library/LibraryFolderSheet';
import {LibraryDeleteDialog} from '../features/library/LibraryDeleteDialog';
import {LibrarySelectionBar, librarySelectionHeight} from '../features/library/LibrarySelectionBar';
import {SelectionMark} from '../features/library/SelectionMark';
import {useLibrarySelection, type LibraryEntry} from './useLibrarySelection';
import {useFolderNavigation} from '../features/library/useFolderNavigation';

interface ListActions {
  rename(id: string, title: string): Promise<void>;
  pin(id: string, pinned: boolean): Promise<void>;
  remove(ids: readonly string[], folders?: FolderRemoval): Promise<void>;
}
export interface ListHeaderState {
  selecting: boolean; count: number; cancel: () => void;
  selection: {progress: Animated.Value; present: boolean};
}
interface Props<T extends ListItem> {
  items: readonly T[]; allItems: readonly T[]; selectedId?: string | undefined;
  actions: ListActions; library?: FolderLibrary | undefined; search?: string;
  onOpen: (item: T) => void; report: (error: unknown) => void;
  scope: 'history' | 'card'; scale: number; resetKey: string; empty: string; active?: boolean;
  header?: (state: ListHeaderState) => ReactNode;
  leading?: (item: T) => ReactNode;
  geometry?: {rowHeight: number; lineHeight: number; fontSize: number; padding: number; inset: number; radius: number; highlightInset: number};
  scroll?: RefObject<SheetScrollState>; onListTouch?: () => void;
}

/** Shared library behavior; cards and histories retain their original row geometry. */
export function ManagedItemList<T extends ListItem>({items, allItems, selectedId, actions, library, search = '', onOpen, report, scope, scale: s, resetKey, empty, active = true, header, leading, geometry, scroll, onListTouch}: Props<T>) {
  const {colors: c} = useAppearance();
  const panel = useRef<View>(null);
  const list = useRef<FlatList<ItemLayout<LibraryEntry<T>>>>(null);
  const menuRow = useRef<View | null>(null);
  const menuRequest = useRef(0);
  const dimensions = useRef({content: 0, viewport: 0});
  const {width, fontScale} = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(width);
  const [menu, setMenu] = useState<(Pick<ItemMenuTarget, 'bounds' | 'anchor' | 'point'> & {entry: LibraryEntry<T>}) | null>(null);
  const [rename, setRename] = useState<LibraryEntry<T> | null>(null);
  const state = useLibrarySelection(allItems, library, active, report);
  const {value, entries, selected, selectedEntries, setSelected, organize, setOrganize, deletion, setDeletion} = state;
  const overlay = !!menu || !!rename || !!organize || !!deletion;
  const navigation = useFolderNavigation({value, initialFolderId: null, blocked: !active || overlay, canVisit: () => true, width: pageWidth});
  const {folderId, navigate: setFolderId} = navigation;
  useEffect(() => {
    if (state.ready && folderId && !value.folders.some(folder => folder.id === folderId)) setFolderId(null);
  }, [state.ready, value.folders, folderId, setFolderId]);
  const reduced = useItemReducedMotion();
  const selection = useItemPresence(selected !== null, reduced);
  const geo = geometry ?? {rowHeight: g.rowHeight, lineHeight: g.rowLine, fontSize: g.rowFont, padding: g.rowInset, inset: 0, radius: g.controlRadius, highlightInset: g.highlightInset};
  const rowHeight = Math.max(geo.rowHeight, geo.lineHeight * fontScale + 2 * g.rowPadding) * s;
  const query = search.trim().toLocaleLowerCase();
  const visibleIds = new Set(items.map(item => item.id));
  const locations = new Map(value.items.map(item => [item.id, item.folderId]));
  const rowsInFolder = (id: string | null) => {
    const visible = entries.filter(entry => entry.kind === 'folder'
      ? (entry.folder.parentId === id || (!id && !!query)) && entry.title.toLocaleLowerCase().includes(query)
      : visibleIds.has(entry.item.id) && ((!id && !!query) || (locations.get(entry.item.id) ?? null) === id));
    const folders = visible.filter(entry => entry.kind === 'folder');
    const leaves = visible.filter(entry => entry.kind === 'item');
    const offset = folders.length * rowHeight;
    return [
      ...folders.map((item, index): ItemLayout<LibraryEntry<T>> => ({kind: 'item', key: item.id, item, top: index * rowHeight, height: rowHeight})),
      ...(leaves.length ? itemListLayout(leaves, rowHeight, 1 + 24 * s).map(row => ({...row, top: row.top + offset})) : []),
    ];
  };
  const footerHeight = librarySelectionHeight * s, footerBottom = 10 * s;
  const currentFolder = value.folders.find(folder => folder.id === folderId);
  const parentId = currentFolder?.parentId ?? null;
  const rootName = scope === 'card' ? '카드' : '채팅내역';
  useEffect(() => {if (!active) {setSelected(null); setMenu(null); setRename(null); setOrganize(null); setDeletion(null); menuRequest.current++;}}, [active, setSelected, setOrganize, setDeletion]);
  useEffect(() => () => {menuRequest.current++;}, []);
  useEffect(() => {list.current?.scrollToOffset({offset: 0, animated: false}); if (scroll) scroll.current.offset = 0;}, [folderId, scroll]);
  const back = useCallback(() => {
    if (!active || overlay) return false;
    if (selected) {setSelected(null); return true;}
    if (folderId) {setFolderId(parentId); return true;}
    return false;
  }, [active, overlay, selected, folderId, parentId, setFolderId, setSelected]);
  useEffect(() => {
    const native = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', back) : undefined;
    if (Platform.OS !== 'web') return () => native?.remove();
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && !event.defaultPrevented && back()) {event.preventDefault(); event.stopImmediatePropagation();}};
    document.addEventListener('keydown', escape, true);
    return () => {native?.remove(); document.removeEventListener('keydown', escape, true);};
  }, [back]);
  const navigate = (id: string | null) => {Keyboard.dismiss(); setSelected(null); setFolderId(id);};
  const select = (entry: LibraryEntry<T>) => {
    if (overlay) return;
    if (selected) state.toggle(entry);
    else if (entry.kind === 'folder') navigate(entry.folder.id);
    else {Keyboard.dismiss(); onOpen(entry.item);}
  };
  const measureMenu = (row: View, accept: (placement: Pick<ItemMenuTarget, 'bounds' | 'anchor'>) => void) => {
    panel.current?.measureInWindow((left, top, width, height) => {
      if (width <= 0 || height <= 0) return;
      row.measureInWindow((rowLeft, rowTop, rowWidth, rowHeight) => {
        if (rowWidth > 0 && rowHeight > 0) accept({bounds: {left, top, width, height}, anchor: {left: rowLeft, top: rowTop, width: rowWidth, height: rowHeight}});
      });
    });
  };
  const openMenu = (entry: LibraryEntry<T>, row: View, point?: MenuPoint) => {
    if (overlay || !active) return;
    const request = ++menuRequest.current;
    Keyboard.dismiss();
    measureMenu(row, placement => {
      if (request !== menuRequest.current) return;
      menuRow.current = row; selectionHaptic();
      setMenu({entry, ...placement, ...(point ? {point} : {})});
    });
  };
  const measureList = (kind: 'content' | 'viewport', height: number) => {
    dimensions.current[kind] = height;
    if (scroll) scroll.current.canScroll = dimensions.current.content > dimensions.current.viewport + 1;
  };
  const menuEntries = menu ? selected?.has(menu.entry.id) ? selectedEntries : [menu.entry] : [];
  const renderFolder = (id: string | null, interactive: boolean) => {
    const rows = rowsInFolder(id);
    const parent = value.folders.find(folder => folder.id === id)?.parentId ?? null;
    const parentName = value.folders.find(folder => folder.id === parent)?.name ?? rootName;
    return <FlatList ref={interactive ? list : undefined} testID={interactive ? scope === 'card' ? 'card-list' : 'card-conversation-list' : undefined} data={rows} keyExtractor={item => item.key} CellRendererComponent={ItemListCell} style={{flex: 1}} removeClippedSubviews={false}
          contentContainerStyle={{flexGrow: 1, paddingHorizontal: geo.inset * s, paddingBottom: scope === 'card' ? 12 * s : 0}}
          extraData={{selected, selectedId, menu: menu?.entry.id}}
          getItemLayout={(_, index) => ({index, length: rows[index]!.height, offset: rows[index]!.top + (id ? rowHeight : 0)})}
          onLayout={event => {if (interactive) measureList('viewport', event.nativeEvent.layout.height);}} onContentSizeChange={(_, height) => {if (interactive) measureList('content', height);}}
          onScrollBeginDrag={() => {menuRequest.current++;}}
          onScroll={event => {if (scroll && interactive) scroll.current.offset = Math.max(0, event.nativeEvent.contentOffset.y);}} scrollEventThrottle={16}
          ListHeaderComponent={id ? <RowPressable accessibilityRole="button" accessibilityLabel={`상위 폴더, ${parentName}`} onPress={() => navigate(parent)} radius={geo.radius * s}
            contentStyle={{height: rowHeight, paddingHorizontal: geo.padding * s, flexDirection: 'row', alignItems: 'center', gap: 18 * s}}>
            <View style={{transform: [{rotate: '-90deg'}]}}><SettingsIcon name="chevron" size={30 * s} color={c.muted}/></View><Text style={{color: c.muted, fontSize: geo.fontSize * s}}>{parentName}</Text>
          </RowPressable> : null}
          ListFooterComponentStyle={{flexGrow: 1}}
          ListFooterComponent={<Pressable testID={interactive ? `${scope}-selection-blank` : undefined} accessibilityRole="button" accessibilityLabel="빈 공간 눌러 선택 해제" accessible={selected !== null} onPress={() => setSelected(null)} style={{flexGrow: 1, minHeight: 36 * s}}>
            <Animated.View pointerEvents="none" style={{height: selection.progress.interpolate({inputRange: [0, 1], outputRange: [0, footerHeight + footerBottom + 18 * s]})}}/>
          </Pressable>}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={{paddingHorizontal: geo.padding * s, paddingVertical: 19 * s, color: c.muted, fontSize: 23 * s}}>{id && !query ? '폴더가 비어 있어요.' : empty}</Text>}
          renderItem={({item}) => <ItemMotionCell item={item} resetKey={`${resetKey}:${id}:${rowHeight}`} reduced={reduced} backgroundColor={c.drawer} radius={geo.radius * s}>
            {item.kind === 'divider' ? <ItemPinDivider scope={scope} visible={item.visible} scale={s} inset={geo.padding} reduced={reduced}/> :
              <ItemRow entry={item.item} interactive={interactive} scope={scope} scale={s} height={rowHeight} geometry={geo} leading={item.item.kind === 'item' ? leading?.(item.item.item) : undefined} selecting={selected !== null} selectionProgress={selection.progress} reduced={reduced}
                selected={selected ? selected.has(item.item.id) : item.item.id === (menu?.entry.id ?? `item:${selectedId}`)}
                onPress={() => select(item.item)} onLongPress={(row, point) => openMenu(item.item, row, point)}/>}
          </ItemMotionCell>}/>;
  };
  return <View ref={panel} collapsable={false} testID={`${scope}-content`} style={{flex: 1}} onLayout={() => {
    if (menu && menuRow.current) measureMenu(menuRow.current, placement => setMenu(current => current ? {...current, ...placement} : null));
  }}>
    <View style={{flex: 1}} pointerEvents={overlay ? 'none' : 'auto'} aria-hidden={overlay} accessibilityElementsHidden={overlay} importantForAccessibility={overlay ? 'no-hide-descendants' : 'auto'}>
      {header?.({selecting: selected !== null, count: selectedEntries.length, cancel: () => setSelected(null), selection})}
      {library && <View style={{minHeight: referenceHeader.height * s, paddingHorizontal: geo.inset * s, justifyContent: 'center'}}>
        <View style={{minWidth: 0, paddingLeft: Math.max(0, geo.padding - 12) * s}}><FolderBreadcrumbs path={folderPath(value, folderId)} rootName={rootName} scale={s} testID={`${scope}-folder-path`} onNavigate={navigate}/></View>
      </View>}
      {!!state.error && <RowPressable accessibilityRole="button" accessibilityLabel="폴더 다시 불러오기" onPress={() => {void library?.refresh().catch(report);}} radius={geo.radius * s} contentStyle={{padding: geo.padding * s}}><Text style={{color: c.error}}>{state.error}</Text></RowPressable>}
      <View style={{flex: 1, overflow: 'hidden'}} onLayout={event => setPageWidth(Math.max(1, event.nativeEvent.layout.width))} onStartShouldSetResponderCapture={() => {onListTouch?.(); return false;}}>
        {(navigation.transition ? [navigation.transition.from, navigation.transition.to] : [folderId]).map(id => {
          const interactive = id === folderId;
          return <Animated.View key={id ?? 'root'} testID={interactive ? `${scope}-folder-current` : `${scope}-folder-outgoing`} pointerEvents={interactive ? 'auto' : 'none'}
            aria-hidden={!interactive} accessibilityElementsHidden={!interactive} importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
            style={[StyleSheet.absoluteFill, navigation.transition ? id === navigation.transition.to ? navigation.incoming : navigation.outgoing : undefined]}>
            {renderFolder(id, interactive)}
          </Animated.View>;
        })}
      </View>
      <LibrarySelectionBar scope={scope} count={selectedEntries.length} canMove={!!library && state.ready && !!selectedEntries.length} progress={selection.progress} present={selection.present}
        scale={s} bottom={footerBottom} onCancel={() => setSelected(null)} onFolder={() => state.requestMove(selectedEntries, folderId)} onDelete={() => state.requestDelete(selectedEntries)}/>
    </View>
    {menu && <AnchoredActionMenu target={menu} scale={s} scope={scope} closeLabel={scope === 'card' ? '카드 메뉴 닫기' : '채팅내역 메뉴 닫기'} onClose={() => {menuRequest.current++; menuRow.current = null; setMenu(null);}} actions={[
      {label: selected?.has(menu.entry.id) ? '선택 해제' : '선택', icon: 'select', action: () => state.toggle(menu.entry)},
      ...(library && state.ready ? [{label: '폴더 이동', icon: 'folder' as const, action: () => state.requestMove(menuEntries, folderId)}] : []),
      ...(menu.entry.kind === 'item' ? [{label: menu.entry.pinnedAt == null ? '고정' : '고정 해제', icon: 'pin' as const, action: () => {if (menu.entry.kind === 'item') void actions.pin(menu.entry.item.id, menu.entry.pinnedAt == null).catch(report);}}] : []),
      {label: '이름 변경', icon: 'edit', action: () => setRename(menu.entry)},
      {label: '삭제', icon: 'delete', danger: true, action: () => state.requestDelete(menuEntries)},
    ]}/>}
    {rename && <ItemRenameSheet item={rename} scope={rename.kind === 'folder' ? `${scope}-folder` : scope} {...(rename.kind === 'folder' ? {inputLabel: '폴더 이름', maxLength: 40} : {})}
      onClose={() => setRename(null)} onSave={title => rename.kind === 'folder' ? library!.renameFolder(rename.folder.id, title) : actions.rename(rename.item.id, title)}/>}
    {deletion && <LibraryDeleteDialog scope={scope} title="삭제할까요?" detail={deletion.detail} onClose={() => {setDeletion(null); setSelected(null);}} onDelete={async () => {
      await actions.remove(deletion.ids, library ? {scope: library.scope, folderIds: deletion.folderIds} : undefined);
      await library?.refresh();
    }}/>}
    {organize?.screen === 'choose' && library && <LibraryFolderSheet {...organize} scope={scope} rootName={rootName} initialFolderId={folderId} value={value} store={library}
      onClose={() => setOrganize(null)} onMoved={() => setSelected(null)}/>}
    {organize?.screen === 'create' && library && <ItemRenameSheet scope={`${scope}-folder`} item={{title: organize.name}} heading="새 폴더" inputLabel="폴더 이름" maxLength={40}
      onClose={() => setOrganize(null)} onSave={async name => {await library.createFolder(name, organize.ids, organize.parentId, organize.folderIds); setSelected(null);}}/>}
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
function ItemRow<T extends ListItem>({entry, interactive, scope, scale: s, height, geometry, leading, selecting, selectionProgress, reduced, selected, onPress, onLongPress}: {
  entry: LibraryEntry<T>; scope: 'card' | 'history'; scale: number; height: number; geometry: NonNullable<Props<ListItem>['geometry']>; leading?: ReactNode;
  interactive: boolean; selecting: boolean; selectionProgress: Animated.Value; reduced: boolean; selected: boolean; onPress: () => void; onLongPress: (row: View, point?: MenuPoint) => void;
}) {
  const {colors: c} = useAppearance();
  const row = useRef<View>(null);
  const id = entry.kind === 'item' ? entry.item.id : entry.folder.id;
  const openMenu = (event?: GestureResponderEvent) => {
    const touch = event?.nativeEvent;
    if (row.current) onLongPress(row.current, touch ? {x: touch.pageX, y: touch.pageY} : undefined);
  };
  const {progress: highlight} = useItemPresence(selected, reduced, true);
  const {progress: pinned} = useItemPresence(entry.pinnedAt != null, reduced);
  const pinVisibility = Animated.multiply(pinned, Animated.subtract(1, selectionProgress));
  return <View ref={row} collapsable={false} testID={interactive ? `sidebar-anchor-${id}` : undefined}><RowPressable testID={interactive ? `sidebar-row-${id}` : undefined} accessibilityRole={selecting ? 'checkbox' : 'button'}
    accessibilityLabel={entry.kind === 'folder' ? `${entry.title} 폴더` : selecting ? entry.title : `${entry.title}${scope === 'card' ? ' 카드의 채팅 기록' : ' 채팅 열기'}`}
    accessibilityHint="길게 눌러 메뉴 열기" accessibilityState={selecting ? {checked: selected} : {selected}}
    accessibilityActions={[{name: 'longpress', label: '메뉴 열기'}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'longpress') openMenu();}}
    selected={selected} selectedHighlight={scope === 'history' || selecting ? 'pressed' : 'full'} selectionProgress={highlight} delayLongPress={420}
    onPress={onPress} onLongPress={openMenu} radius={geometry.radius * s} highlightInset={geometry.highlightInset * s}
    contentStyle={{height, paddingHorizontal: geometry.padding * s, flexDirection: 'row', alignItems: 'center'}}>
    {entry.kind === 'folder' ? <View style={{width: referenceSidebar.cardImage * s, marginRight: referenceSidebar.cardImageGap * s, alignItems: 'center'}}><SettingsIcon name="folder" size={38 * s} color={c.text}/></View> : leading}
    <Text numberOfLines={1} style={{flex: 1, minWidth: 0, color: c.text, fontSize: geometry.fontSize * s, lineHeight: geometry.lineHeight * s, fontWeight: '400', includeFontPadding: false}}>{entry.title}</Text>
    {entry.kind === 'folder' ? <Animated.View pointerEvents="none" style={{width: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [42 * s, 0]}), opacity: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [1, 0]}), alignItems: 'flex-end', overflow: 'hidden'}}><SettingsIcon name="chevron" size={24 * s} color={c.muted}/></Animated.View>
      : <Animated.View pointerEvents="none" accessible={false} aria-hidden style={{width: pinVisibility.interpolate({inputRange: [0, 1], outputRange: [0, 40 * s]}), alignItems: 'flex-end', opacity: pinVisibility, overflow: 'hidden'}}><SettingsIcon name="pin" size={24 * s} color={c.muted}/></Animated.View>}
    <SelectionMark testID={`${scope}-check-${id}`} scale={s} selectionProgress={selectionProgress} checkedProgress={highlight}/>
  </RowPressable></View>;
}
