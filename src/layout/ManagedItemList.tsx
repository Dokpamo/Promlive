import {useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {Animated, BackHandler, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type CellRendererProps, type GestureResponderEvent} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
import {itemGridLayout, type ManagedLayout} from './itemGridLayout';
import type {SheetScrollState} from './sheetMotion';
import type {FolderLibrary, FolderRemoval} from '../features/library/FolderLibrary';
import {folderPath} from '../features/library/folderTree';
import {FolderBreadcrumbs} from '../features/library/FolderBreadcrumbs';
import {LibraryFolderSheet} from '../features/library/LibraryFolderSheet';
import {LibraryDeleteDialog} from '../features/library/LibraryDeleteDialog';
import {LibrarySelectionBar, librarySelectionHeight} from '../features/library/LibrarySelectionBar';
import {LibrarySelectionChrome, librarySelectionPageHeight} from '../features/library/LibrarySelectionChrome';
import {CoverSelectionMark, SelectionMark} from '../features/library/SelectionMark';
import {useLibrarySelection, type LibraryEntry} from './useLibrarySelection';
import {useFolderNavigation} from '../features/library/useFolderNavigation';
import {useScrollChromeTarget, type ScrollChromeBinding} from './scrollChrome';

interface ListActions {
  edit?(id: string): Promise<void>;
  export?(id: string): Promise<void>;
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
  grid?: {columns: number; cover: (item: T, width: number, height: number) => ReactNode; byline?: (item: T) => string};
  categoryId?: string | null;
  subtitle?: (item: T) => string;
  openLabel?: (item: T) => string;
  onBack?: () => void;
  backgroundColor?: string;
  geometry?: {rowHeight: number; lineHeight: number; fontSize: number; padding: number; inset: number; radius: number; highlightInset: number};
  scroll?: RefObject<SheetScrollState>; onListTouch?: () => void;
  scrollChrome?: ScrollChromeBinding;
  hideRootBreadcrumb?: boolean;
  rootLabel?: string;
  selectionVariant?: 'page';
  onSelectionChange?: (selecting: boolean) => void;
}

/** Rows and cover grids share folder navigation, menus and selection behavior. */
export function ManagedItemList<T extends ListItem>({items, allItems, selectedId, actions, library, search = '', onOpen, report, scope, scale: s, resetKey, empty, active = true, header, leading, grid, categoryId, subtitle, openLabel, onBack, backgroundColor, geometry, scroll, onListTouch, scrollChrome, hideRootBreadcrumb = false, rootLabel, selectionVariant, onSelectionChange}: Props<T>) {
  const {colors: c} = useAppearance();
  const safe = useSafeAreaInsets();
  const panel = useRef<View>(null);
  const list = useRef<FlatList<ManagedLayout<LibraryEntry<T>>>>(null);
  useScrollChromeTarget(scrollChrome, active, offset => list.current?.scrollToOffset({offset, animated: false}));
  const gridPositions = useRef(new Map<string, GridPosition>()).current;
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
  const pageSelection = selectionVariant === 'page';
  useLayoutEffect(() => {onSelectionChange?.(active && selection.present);}, [active, selection.present, onSelectionChange]);
  useLayoutEffect(() => () => onSelectionChange?.(false), [onSelectionChange]);
  const geo = geometry ?? {rowHeight: g.rowHeight, lineHeight: g.rowLine, fontSize: g.rowFont, padding: g.rowInset, inset: 0, radius: g.controlRadius, highlightInset: g.highlightInset};
  const rowHeight = Math.max(geo.rowHeight, geo.lineHeight * fontScale + 2 * g.rowPadding) * s;
  const gridGap = 3 * s;
  const tileWidth = Math.max(1, (pageWidth - 2 * geo.inset * s - gridGap * ((grid?.columns ?? 1) - 1)) / (grid?.columns ?? 1));
  const coverHeight = tileWidth * 4 / 3;
  const tileHeight = coverHeight + (10 + 62 * fontScale + (grid?.byline ? 8 + 25 * fontScale : 0)) * s;
  const query = search.trim().toLocaleLowerCase();
  const visibleIds = new Set(items.map(item => item.id));
  const locations = new Map(value.items.map(item => [item.id, item.folderId]));
  const rowsInFolder = (id: string | null) => {
    const visible = entries.filter(entry => entry.kind === 'folder'
      ? categoryId === undefined && (entry.folder.parentId === id || (!id && !!query)) && entry.title.toLocaleLowerCase().includes(query)
      : visibleIds.has(entry.item.id) && (categoryId !== undefined || (!id && !!query) || (locations.get(entry.item.id) ?? null) === id));
    const folders = visible.filter(entry => entry.kind === 'folder');
    const leaves = visible.filter(entry => entry.kind === 'item');
    const offset = folders.length * rowHeight;
    return [
      ...folders.map((item, index): ItemLayout<LibraryEntry<T>> => ({kind: 'item', key: item.id, item, top: index * rowHeight, height: rowHeight})),
      ...(leaves.length ? itemListLayout(leaves, rowHeight, 1 + 24 * s).map(row => ({...row, top: row.top + offset})) : []),
    ];
  };
  const footerHeight = (pageSelection ? librarySelectionPageHeight : librarySelectionHeight) * s;
  const bottomInset = pageSelection ? safe.bottom : scrollChrome?.bottomInset ?? 0;
  const footerBottom = 10 * s + (pageSelection ? safe.bottom : bottomInset);
  const currentFolder = value.folders.find(folder => folder.id === folderId);
  const parentId = currentFolder?.parentId ?? null;
  const rootName = rootLabel ?? (scope === 'card' ? '카드' : '채팅내역');
  const resetChrome = scrollChrome?.reset;
  const selecting = selected !== null;
  useEffect(() => {if (active) resetChrome?.();}, [active, folderId, overlay, selecting, resetKey, resetChrome]);
  useEffect(() => {if (!active) {setSelected(null); setMenu(null); setRename(null); setOrganize(null); setDeletion(null); menuRequest.current++;}}, [active, setSelected, setOrganize, setDeletion]);
  useEffect(() => () => {menuRequest.current++;}, []);
  useEffect(() => {list.current?.scrollToOffset({offset: 0, animated: false}); if (scroll) scroll.current.offset = 0;}, [folderId, scroll]);
  useEffect(() => {if (categoryId !== undefined) {setSelected(null); list.current?.scrollToOffset({offset: 0, animated: false});}}, [categoryId, setSelected]);
  const back = useCallback(() => {
    if (!active || overlay) return false;
    if (selected) {setSelected(null); return true;}
    if (folderId) {setFolderId(parentId); return true;}
    if (onBack) {onBack(); return true;}
    return false;
  }, [active, overlay, selected, folderId, parentId, setFolderId, setSelected, onBack]);
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
  const hold = (entry: LibraryEntry<T>, row: View, point?: MenuPoint) => {
    if (!pageSelection) {openMenu(entry, row, point); return;}
    if (overlay || !active) return;
    Keyboard.dismiss(); selectionHaptic();
    setSelected(current => new Set(current).add(entry.id));
  };
  const measureList = (kind: 'content' | 'viewport', height: number) => {
    dimensions.current[kind] = height;
    if (scroll) scroll.current.canScroll = dimensions.current.content > dimensions.current.viewport + 1;
  };
  const menuEntries = menu ? selected?.has(menu.entry.id) ? selectedEntries : [menu.entry] : [];
  const menuItems = menuEntries.filter(entry => entry.kind === 'item');
  const menuSingle = !pageSelection || menuEntries.length === 1;
  const visibleEntries = rowsInFolder(folderId).flatMap(row => row.kind === 'item' ? [row.item] : []);
  const allSelected = visibleEntries.length > 0 && visibleEntries.every(entry => selected?.has(entry.id));
  const toggleAll = () => setSelected(current => {
    const next = new Set(current);
    for (const entry of visibleEntries) {if (allSelected) next.delete(entry.id); else next.add(entry.id);}
    return next.size ? next : null;
  });
  const breadcrumbs = (id: string | null) => library && (!hideRootBreadcrumb || id !== null) ? <View style={{minHeight: referenceHeader.height * s, paddingHorizontal: geo.inset * s, justifyContent: 'center'}}>
    <View style={{minWidth: 0, paddingLeft: Math.max(0, geo.padding - 12) * s}}><FolderBreadcrumbs path={folderPath(value, id)} rootName={rootName} scale={s} testID={`${scope}-folder-path`} onNavigate={navigate}/></View>
  </View> : null;
  const renderFolder = (id: string | null, interactive: boolean) => {
    const source = rowsInFolder(id);
    const rows = grid ? itemGridLayout(source, grid.columns, tileHeight + gridGap) : source;
    const parent = value.folders.find(folder => folder.id === id)?.parentId ?? null;
    const parentName = value.folders.find(folder => folder.id === parent)?.name ?? rootName;
    return <FlatList ref={interactive ? list : undefined} testID={interactive ? scope === 'card' ? 'card-list' : 'card-conversation-list' : undefined} data={rows} keyExtractor={item => item.key} CellRendererComponent={ItemListCell} style={{flex: 1}} removeClippedSubviews={false}
          contentContainerStyle={{flexGrow: 1, paddingHorizontal: geo.inset * s, paddingTop: scrollChrome?.animatedTopInset ? 0 : scrollChrome?.topInset ?? 0, paddingBottom: (scope === 'card' ? 12 * s : 0) + bottomInset}}
          extraData={{selected, selectedId, menu: menu?.entry.id}}
          getItemLayout={(_, index) => ({index, length: rows[index]!.height, offset: rows[index]!.top + (id ? rowHeight : 0)
            + (scrollChrome?.topInset ?? 0) + (scrollChrome && library && (!hideRootBreadcrumb || id !== null) ? referenceHeader.height * s : 0)})}
          onLayout={event => {if (interactive) measureList('viewport', event.nativeEvent.layout.height);}} onContentSizeChange={(_, height) => {if (interactive) measureList('content', height);}}
          onScrollBeginDrag={event => {menuRequest.current++; if (interactive && active && !overlay && !selecting) scrollChrome?.onScrollBeginDrag(event);}}
          onScrollEndDrag={event => {if (interactive && active && !overlay && !selecting) scrollChrome?.onScrollEndDrag(event);}}
          onMomentumScrollBegin={event => {if (interactive && active && !overlay && !selecting) scrollChrome?.onMomentumScrollBegin(event);}}
          onMomentumScrollEnd={event => {if (interactive && active && !overlay && !selecting) scrollChrome?.onMomentumScrollEnd(event);}}
          onScroll={event => {
            if (!interactive) return;
            if (scroll) scroll.current.offset = Math.max(0, event.nativeEvent.contentOffset.y);
            if (active && !overlay && !selecting) scrollChrome?.onScroll(event);
          }} scrollEventThrottle={16}
          ListHeaderComponent={<>{scrollChrome?.animatedTopInset && <Animated.View pointerEvents="none" style={{height: scrollChrome.animatedTopInset}}/>}{scrollChrome && breadcrumbs(id)}{id ? <RowPressable accessibilityRole="button" accessibilityLabel={`상위 폴더, ${parentName}`} onPress={() => navigate(parent)} radius={geo.radius * s}
            contentStyle={{height: rowHeight, paddingHorizontal: geo.padding * s, flexDirection: 'row', alignItems: 'center', gap: 18 * s}}>
            <View style={{transform: [{rotate: '-90deg'}]}}><SettingsIcon name="chevron" size={30 * s} color={c.muted}/></View><Text style={{color: c.muted, fontSize: geo.fontSize * s}}>{parentName}</Text>
          </RowPressable> : null}</>}
          ListFooterComponentStyle={{flexGrow: 1}}
          ListFooterComponent={<Pressable testID={interactive ? `${scope}-selection-blank` : undefined} accessibilityRole="button" accessibilityLabel="빈 공간 눌러 선택 해제" accessible={selected !== null} onPress={() => setSelected(null)} style={{flexGrow: 1, minHeight: 36 * s}}>
            <Animated.View pointerEvents="none" style={{height: selection.progress.interpolate({inputRange: [0, 1], outputRange: [pageSelection ? 36 * s + Math.max(0, (scrollChrome?.bottomInset ?? 0) - safe.bottom) : 0, footerHeight + 28 * s]})}}/>
          </Pressable>}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={{paddingHorizontal: geo.padding * s, paddingVertical: 19 * s, color: c.muted, fontSize: 23 * s}}>{id && !query ? '폴더가 비어 있어요.' : empty}</Text>}
          renderItem={({item}) => item.kind === 'grid' ? <View style={{height: item.height, flexDirection: 'row', gap: gridGap, overflow: 'visible'}}>
            {item.items.map((entry, column) => <GridMotionCell key={entry.id} id={entry.id} left={column * (tileWidth + gridGap)} top={item.top} width={tileWidth}
              resetKey={`${resetKey}:${id}:${tileWidth}:${tileHeight}`} positions={gridPositions} reduced={reduced}>
              <ItemRow entry={entry} interactive={interactive} scope={scope} scale={s} height={tileHeight} geometry={geo}
                tile={{width: tileWidth, coverHeight}} leading={entry.kind === 'item' ? grid!.cover(entry.item, tileWidth, coverHeight) : undefined}
                subtitle={entry.kind === 'item' ? grid?.byline?.(entry.item) : undefined}
                selecting={selected !== null} selectionProgress={selection.progress} reduced={reduced} openLabel={entry.kind === 'item' ? openLabel?.(entry.item) : undefined}
                selected={selected ? selected.has(entry.id) : entry.id === (menu?.entry.id ?? `item:${selectedId}`)}
                longPressSelect={pageSelection} onPress={() => select(entry)} onLongPress={(row, point) => hold(entry, row, point)}/>
            </GridMotionCell>)}
          </View> : <ItemMotionCell item={item} resetKey={`${resetKey}:${id}:${rowHeight}`} reduced={reduced} backgroundColor={backgroundColor ?? c.drawer} radius={geo.radius * s}>
            {item.kind === 'divider' ? <ItemPinDivider scope={scope} visible={item.visible} scale={s} inset={geo.padding} reduced={reduced}/> :
              <ItemRow entry={item.item} interactive={interactive} scope={scope} scale={s} height={rowHeight} geometry={geo} leading={item.item.kind === 'item' ? leading?.(item.item.item) : undefined} selecting={selected !== null} selectionProgress={selection.progress} reduced={reduced}
                subtitle={item.item.kind === 'item' ? subtitle?.(item.item.item) : undefined} openLabel={item.item.kind === 'item' ? openLabel?.(item.item.item) : undefined}
                selected={selected ? selected.has(item.item.id) : item.item.id === (menu?.entry.id ?? `item:${selectedId}`)}
              longPressSelect={pageSelection} onPress={() => select(item.item)} onLongPress={(row, point) => hold(item.item, row, point)}/>}
          </ItemMotionCell>}/>;
  };
  return <View ref={panel} collapsable={false} testID={`${scope}-content`} style={{flex: 1}} onLayout={() => {
    if (menu && menuRow.current) measureMenu(menuRow.current, placement => setMenu(current => current ? {...current, ...placement} : null));
  }}>
    <View style={{flex: 1}} pointerEvents={overlay ? 'none' : 'auto'} aria-hidden={overlay} accessibilityElementsHidden={overlay} importantForAccessibility={overlay ? 'no-hide-descendants' : 'auto'}>
      {header?.({selecting: selected !== null, count: selectedEntries.length, cancel: () => setSelected(null), selection})}
      {!scrollChrome && breadcrumbs(folderId)}
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
      {pageSelection ? <LibrarySelectionChrome scope={scope} count={selectedEntries.length} allSelected={allSelected} canMove={!!library && state.ready && !!selectedEntries.length}
        progress={selection.progress} present={selection.present} scale={s} bottom={footerBottom} onCancel={() => setSelected(null)} onToggleAll={toggleAll}
        onFolder={() => state.requestMove(selectedEntries, categoryId ?? folderId)} onDelete={() => state.requestDelete(selectedEntries)}
        onMore={anchor => {if (selectedEntries[0]) openMenu(selectedEntries[0], anchor);}}/>
        : <LibrarySelectionBar scope={scope} count={selectedEntries.length} canMove={!!library && state.ready && !!selectedEntries.length} progress={selection.progress} present={selection.present}
          scale={s} bottom={footerBottom} onCancel={() => setSelected(null)} onFolder={() => state.requestMove(selectedEntries, categoryId ?? folderId)} onDelete={() => state.requestDelete(selectedEntries)}/>}
    </View>
    {menu && <AnchoredActionMenu target={menu} scale={s} scope={scope} closeLabel={scope === 'card' ? '카드 메뉴 닫기' : '채팅내역 메뉴 닫기'} onClose={() => {menuRequest.current++; menuRow.current = null; setMenu(null);}} actions={[
      ...(!pageSelection ? [{label: selected?.has(menu.entry.id) ? '선택 해제' : '선택', icon: 'select' as const, action: () => state.toggle(menu.entry)}] : []),
      ...(!pageSelection && library && state.ready ? [{label: categoryId !== undefined ? '분류 이동' : '폴더 이동', icon: 'folder' as const, action: () => state.requestMove(menuEntries, categoryId ?? folderId)}] : []),
      ...(pageSelection && menuItems.length ? [{label: menuItems.some(entry => entry.pinnedAt == null) ? '고정' : '고정 해제', icon: 'pin' as const, action: () => {
        const pin = menuItems.some(entry => entry.pinnedAt == null);
        void Promise.all(menuItems.map(entry => actions.pin(entry.item.id, pin))).catch(report);
      }}] : !pageSelection && menu.entry.kind === 'item' ? [{label: menu.entry.pinnedAt == null ? '고정' : '고정 해제', icon: 'pin' as const, action: () => {if (menu.entry.kind === 'item') void actions.pin(menu.entry.item.id, menu.entry.pinnedAt == null).catch(report);}}] : []),
      ...(menuSingle ? [{label: '이름 변경', icon: 'edit' as const, action: () => setRename(menu.entry)}] : []),
      ...(menuSingle && menu.entry.kind === 'item' && actions.edit ? [{label: '카드 편집', icon: 'edit' as const, action: () => {if (menu.entry.kind === 'item') void actions.edit?.(menu.entry.item.id).catch(report);}}] : []),
      ...(menuSingle && menu.entry.kind === 'item' && actions.export ? [{label: '내보내기', icon: 'export' as const, action: () => {if (menu.entry.kind === 'item') void actions.export?.(menu.entry.item.id).catch(report);}}] : []),
      ...(!pageSelection ? [{label: '삭제', icon: 'delete' as const, danger: true, action: () => state.requestDelete(menuEntries)}] : []),
    ]}/>}
    {rename && <ItemRenameSheet item={rename} scope={rename.kind === 'folder' ? `${scope}-folder` : scope} {...(rename.kind === 'folder' ? {inputLabel: '폴더 이름', maxLength: 40} : {})}
      onClose={() => setRename(null)} onSave={title => rename.kind === 'folder' ? library!.renameFolder(rename.folder.id, title) : actions.rename(rename.item.id, title)}/>}
    {deletion && <LibraryDeleteDialog scope={scope} title="삭제할까요?" detail={deletion.detail} onClose={() => {setDeletion(null); setSelected(null);}} onDelete={async () => {
      await actions.remove(deletion.ids, library ? {scope: library.scope, folderIds: deletion.folderIds} : undefined);
      await library?.refresh();
    }}/>}
    {organize?.screen === 'choose' && library && <LibraryFolderSheet {...organize} scope={scope} rootName={rootName} initialFolderId={categoryId ?? folderId} value={value} store={library}
      onClose={() => setOrganize(null)} onMoved={() => setSelected(null)}/>}
    {organize?.screen === 'create' && library && <ItemRenameSheet scope={`${scope}-folder`} item={{title: organize.name}} heading="새 폴더" inputLabel="폴더 이름" maxLength={40}
      onClose={() => setOrganize(null)} onSave={async name => {await library.createFolder(name, organize.ids, organize.parentId, organize.folderIds); setSelected(null);}}/>}
  </View>;
}

function ItemListCell<T extends ListItem>({item, index, children, style, onLayout, onFocusCapture}: CellRendererProps<ManagedLayout<T>>) {
  const pinned = item.kind === 'grid' ? item.items.some(entry => entry.pinnedAt != null) : item.kind === 'item' && item.item.pinnedAt != null;
  const layer = pinned ? Math.max(1, 10000 - index) : 0;
  const events = {onLayout, onFocusCapture};
  return <View {...events} style={[style, {zIndex: layer}]}>{children}</View>;
}
type GridPosition = {left: number; top: number; resetKey: string};
function GridMotionCell({id, left, top, width, resetKey, positions, reduced, children}: GridPosition & {id: string; width: number; positions: Map<string, GridPosition>; reduced: boolean; children: ReactNode}) {
  // A pin can move a tile into a different virtualized row. Preserve its origin
  // across that remount so both axes animate from the old visual position.
  const saved = positions.get(id);
  const previous = saved?.resetKey === resetKey ? saved : undefined;
  const x = useItemRowOffset(left, resetKey, reduced, previous?.left);
  const y = useItemRowOffset(top, resetKey, reduced, previous?.top);
  useLayoutEffect(() => {positions.set(id, {left, top, resetKey});}, [id, left, top, resetKey, positions]);
  return <Animated.View style={{width, transform: [{translateX: x}, {translateY: y}]}}>{children}</Animated.View>;
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
function ItemRow<T extends ListItem>({entry, interactive, scope, scale: s, height, geometry, leading, tile, subtitle, openLabel, selecting, selectionProgress, reduced, selected, onPress, onLongPress, longPressSelect = false}: {
  entry: LibraryEntry<T>; scope: 'card' | 'history'; scale: number; height: number; geometry: NonNullable<Props<ListItem>['geometry']>; leading?: ReactNode;
  tile?: {width: number; coverHeight: number};
  subtitle?: string | undefined; openLabel?: string | undefined;
  interactive: boolean; selecting: boolean; selectionProgress: Animated.Value; reduced: boolean; selected: boolean; onPress: () => void; onLongPress: (row: View, point?: MenuPoint) => void;
  longPressSelect?: boolean;
}) {
  const {colors: c} = useAppearance();
  const row = useRef<View>(null);
  const id = entry.kind === 'item' ? entry.item.id : entry.folder.id;
  const openMenu = (event?: GestureResponderEvent) => {
    const touch = event?.nativeEvent;
    if (row.current) onLongPress(row.current, touch ? {x: touch.pageX, y: touch.pageY} : undefined);
  };
  const {progress: highlight} = useItemPresence(selected, reduced, true);
  const coverSelection = !!tile && longPressSelect;
  const {progress: pinned} = useItemPresence(entry.pinnedAt != null, reduced);
  const pinVisibility = Animated.multiply(pinned, Animated.subtract(1, selectionProgress));
  return <View ref={row} collapsable={false} testID={interactive ? `sidebar-anchor-${id}` : undefined}><RowPressable testID={interactive ? `sidebar-row-${id}` : undefined} accessibilityRole={selecting ? 'checkbox' : 'button'}
    accessibilityLabel={entry.kind === 'folder' ? `${entry.title} 폴더` : selecting ? entry.title : openLabel ?? `${entry.title}${scope === 'card' ? ' 카드의 채팅 기록' : ' 채팅 열기'}`}
    accessibilityHint={longPressSelect ? '길게 눌러 선택' : '길게 눌러 메뉴 열기'} accessibilityState={selecting ? {checked: selected} : {selected}}
    accessibilityActions={[{name: 'longpress', label: longPressSelect ? '선택' : '메뉴 열기'}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'longpress') openMenu();}}
    selected={selected && !coverSelection} selectedHighlight={scope === 'history' || selecting ? 'pressed' : 'full'} {...(!coverSelection ? {selectionProgress: highlight} : {})} delayLongPress={420}
    onPress={onPress} onLongPress={openMenu} radius={geometry.radius * s} highlightInset={geometry.highlightInset * s}
    contentStyle={tile ? {height, width: tile.width} : {height, paddingHorizontal: geometry.padding * s, flexDirection: 'row', alignItems: 'center'}}>
    {tile ? <>
      {entry.kind === 'folder' ? <View style={{width: tile.width, height: tile.coverHeight, backgroundColor: c.search, borderRadius: 24 * s, alignItems: 'center', justifyContent: 'center'}}>
        <SettingsIcon name="folder" size={64 * s} color={c.muted}/>
      </View> : leading}
      {coverSelection && <>
        <Animated.View pointerEvents="none" style={{position: 'absolute', top: 0, left: 0, width: tile.width, height: tile.coverHeight, backgroundColor: '#000', opacity: Animated.multiply(highlight, 0.12)}}/>
        <CoverSelectionMark testID={`${scope}-check-${id}`} scale={s} selectionProgress={selectionProgress} checkedProgress={highlight}/>
      </>}
      <View style={{flexDirection: 'row', alignItems: 'flex-start', paddingTop: 10 * s, paddingHorizontal: 10 * s}}>
        <View style={{flex: 1, minWidth: 0}}>
          <Text numberOfLines={2} style={{fontSize: 23 * s, lineHeight: 31 * s, color: c.text, includeFontPadding: false}}>{entry.title}</Text>
          {!!subtitle && <Text numberOfLines={1} style={{marginTop: 4 * s, fontSize: 19 * s, lineHeight: 25 * s, color: c.muted, includeFontPadding: false}}>{subtitle}</Text>}
        </View>
        <Animated.View pointerEvents="none" accessible={false} aria-hidden style={{width: pinVisibility.interpolate({inputRange: [0, 1], outputRange: [0, 24 * s]}), paddingTop: 5 * s, opacity: pinVisibility, overflow: 'hidden', alignItems: 'flex-end'}}>
          <SettingsIcon name="pin" size={20 * s} color={c.muted}/>
        </Animated.View>
        {!coverSelection && <SelectionMark testID={`${scope}-check-${id}`} scale={s} selectionProgress={selectionProgress} checkedProgress={highlight}/>}
      </View>
    </> : <>
    {entry.kind === 'folder' ? <View style={{width: referenceSidebar.cardImage * s, marginRight: referenceSidebar.cardImageGap * s, alignItems: 'center'}}><SettingsIcon name="folder" size={38 * s} color={c.text}/></View> : leading}
    <View style={{flex: 1, minWidth: 0, gap: 5 * s}}>
      <Text numberOfLines={1} style={{color: c.text, fontSize: geometry.fontSize * s, lineHeight: geometry.lineHeight * s, fontWeight: '400', includeFontPadding: false}}>{entry.title}</Text>
      {!!subtitle && <Text numberOfLines={1} style={{color: c.muted, fontSize: 21 * s, lineHeight: 28 * s, includeFontPadding: false}}>{subtitle}</Text>}
    </View>
    {entry.kind === 'folder' ? <Animated.View pointerEvents="none" style={{width: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [42 * s, 0]}), opacity: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [1, 0]}), alignItems: 'flex-end', overflow: 'hidden'}}><SettingsIcon name="chevron" size={24 * s} color={c.muted}/></Animated.View>
      : <Animated.View pointerEvents="none" accessible={false} aria-hidden style={{width: pinVisibility.interpolate({inputRange: [0, 1], outputRange: [0, 40 * s]}), alignItems: 'flex-end', opacity: pinVisibility, overflow: 'hidden'}}><SettingsIcon name="pin" size={24 * s} color={c.muted}/></Animated.View>}
    <SelectionMark testID={`${scope}-check-${id}`} scale={s} selectionProgress={selectionProgress} checkedProgress={highlight}/>
    </>}
  </RowPressable></View>;
}
