import {useEffect, useRef, useState} from 'react';
import {ScrollView, Text, View, useWindowDimensions, type LayoutChangeEvent} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppearance} from '../features/appearance/AppAppearance';
import {ChatIcon} from '../features/chat/ChatIcon';
import type {FolderLibrary} from '../features/library/FolderLibrary';
import {folderPath, type FolderTree, type LibraryFolder} from '../features/library/folderTree';
import {LibraryDeleteDialog} from '../features/library/LibraryDeleteDialog';
import {AnchoredActionMenu, type ItemMenuTarget} from '../layout/ItemActions';
import {ItemRenameSheet} from '../layout/ItemRenameSheet';
import {RowPressable} from '../layout/RowPressable';
import {PagingBoundary, usePagingLock} from '../layout/PagingBoundary';
import {panelReference} from '../layout/panelGeometry';
import {useCollectionChrome} from './NavigationChrome';
import {useItemReducedMotion} from '../layout/itemListMotion';
import {FilterPill} from '../design/foundation';
import {collectionHeaderGeometry} from './CollectionHeader';

export const categoryRowHeight = collectionHeaderGeometry.categories;

export function LibraryCategories({library, value, selected, onSelect, onRemove, scale: s, active, variant = 'pill'}: {
  library: FolderLibrary; value: FolderTree; selected: string | null; onSelect: (id: string | null) => void;
  onRemove: (id: string) => Promise<void>; scale: number; active: boolean;
  variant?: 'pill' | 'underline';
}) {
  const {colors: c} = useAppearance();
  const {width, height} = useWindowDimensions(), safe = useSafeAreaInsets();
  const [menu, setMenu] = useState<(Pick<ItemMenuTarget, 'bounds' | 'anchor'> & {folder: LibraryFolder}) | null>(null);
  const [editing, setEditing] = useState<{id: string | null; title: string} | null>(null);
  const [deleting, setDeleting] = useState<LibraryFolder | null>(null);
  const resetChrome = useCollectionChrome()?.reset;
  const strip = useRef<ScrollView>(null);
  const pillBounds = useRef(new Map<string | null, {x: number; width: number}>()).current;
  const viewport = useRef({width, offset: 0});
  const reduced = useItemReducedMotion();
  const revealSelected = () => {
    const pill = pillBounds.get(selected);
    if (!active || !pill) return;
    const margin = panelReference.inset * s;
    const {width, offset} = viewport.current;
    const x = pill.x < offset + margin ? Math.max(0, pill.x - margin)
      : pill.x + pill.width > offset + width - margin ? Math.max(0, pill.x + pill.width - width + margin) : offset;
    if (Math.abs(x - offset) > 1) strip.current?.scrollTo({x, animated: !reduced});
  };
  useEffect(revealSelected, [selected, active, width, s, reduced]);
  const measurePill = (id: string | null, event: LayoutChangeEvent) => {
    pillBounds.set(id, event.nativeEvent.layout);
    if (id === selected) revealSelected();
  };
  const mounted = useRef(false);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {if (!active) {setMenu(null); setEditing(null); setDeleting(null);}}, [active]);
  const overlay = !!menu || !!editing || !!deleting;
  usePagingLock(active && overlay);
  useEffect(() => {if (active && overlay) resetChrome?.();}, [active, overlay, resetChrome]);
  const create = () => {
    let n = 1;
    while (value.folders.some(folder => folder.parentId === null && folder.name === `새 분류 ${n}`)) n++;
    setEditing({id: null, title: `새 분류 ${n}`});
  };
  const choose = (id: string | null) => {resetChrome?.(); onSelect(id);};
  const openMenu = (folder: LibraryFolder, row: View) => row.measureInWindow((left, top, rowWidth, rowHeight) => {
    if (!mounted.current || !active || rowWidth <= 0) return;
    setMenu({folder, anchor: {left, top, width: rowWidth, height: rowHeight},
      bounds: {left: safe.left, top: 0, width: width - safe.left - safe.right, height: height - safe.top - safe.bottom}});
  });
  return <>
    <PagingBoundary>{scrollEvents => <ScrollView ref={strip} {...scrollEvents} horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} testID="library-categories" directionalLockEnabled
      onLayout={event => {viewport.current.width = event.nativeEvent.layout.width; revealSelected();}}
      onScroll={event => {viewport.current.offset = event.nativeEvent.contentOffset.x;}} scrollEventThrottle={16} onContentSizeChange={revealSelected}
      contentContainerStyle={{alignItems: 'center', gap: (variant === 'pill' ? 10 : 0) * s, paddingHorizontal: (variant === 'pill' ? 28 : 12) * s, height: categoryRowHeight * s}}>
      <CategoryTab label="전체" variant={variant} selected={selected === null} scale={s} onPress={() => choose(null)} onLayout={event => measurePill(null, event)}/>
      {value.folders.map(folder => <CategoryTab key={folder.id} label={folderPath(value, folder.id).map(item => item.name).join(' › ')}
        variant={variant} selected={folder.id === selected} scale={s} onPress={() => choose(folder.id)} onLongPress={row => openMenu(folder, row)} onLayout={event => measurePill(folder.id, event)}/>)}
      <RowPressable accessibilityRole="button" accessibilityLabel="새 분류 만들기" testID="library-category-add" onPress={create} radius={0}
        contentStyle={{width: 66 * s, height: categoryRowHeight * s, alignItems: 'center', justifyContent: 'center'}}>
        <ChatIcon name="plus" size={28 * s} color={c.text}/>
      </RowPressable>
    </ScrollView>}</PagingBoundary>
    {menu && <AnchoredActionMenu target={menu} scope="library-category" scale={s} closeLabel="분류 메뉴 닫기" onClose={() => setMenu(null)} actions={[
      {label: '이름 변경', icon: 'edit', action: () => setEditing({id: menu.folder.id, title: menu.folder.name})},
      {label: '삭제', icon: 'delete', danger: true, action: () => setDeleting(menu.folder)},
    ]}/>}
    {editing && <ItemRenameSheet scope="library-category" item={editing} heading={editing.id ? '이름 변경' : '새 분류'} inputLabel="분류 이름" maxLength={40}
      onClose={() => setEditing(null)} onSave={async name => {
        if (editing.id) await library.renameFolder(editing.id, name);
        else {const folder = await library.createFolder(name); choose(folder.id);}
      }}/>}
    {deleting && <LibraryDeleteDialog scope="library-category" title="분류를 삭제할까요?" detail={`“${deleting.name}”\n카드는 서재에 그대로 남아요.`}
      onClose={() => setDeleting(null)} onDelete={async () => {await onRemove(deleting.id); if (selected === deleting.id) choose(null);}}/>}
  </>;
}

function CategoryTab({label, selected, scale: s, onPress, onLongPress, onLayout, variant}: {
  label: string; selected: boolean; scale: number; onPress: () => void; onLongPress?: (row: View) => void; onLayout: (event: LayoutChangeEvent) => void;
  variant: 'pill' | 'underline';
}) {
  const {colors: c} = useAppearance();
  const row = useRef<View>(null);
  const pill = variant === 'pill';
  const ink = selected ? c.text : c.muted;
  const longPress = onLongPress ? {accessibilityHint: '길게 눌러 분류 관리', accessibilityActions: [{name: 'longpress', label: '분류 관리'}],
    onAccessibilityAction: (event: {nativeEvent: {actionName: string}}) => {if (event.nativeEvent.actionName === 'longpress' && row.current) onLongPress(row.current);},
    onLongPress: () => {if (row.current) onLongPress(row.current);}, delayLongPress: 420} : {};
  return <View ref={row} collapsable={false} onLayout={onLayout}>
    {pill ? <FilterPill label={label} accessibilityLabel={`${label} 분류`} selected={selected} onPress={onPress} {...longPress}/> : <RowPressable accessibilityRole="button" accessibilityLabel={`${label} 분류`} accessibilityState={{selected}}
      {...longPress} onPress={onPress} radius={0}
      contentStyle={{height: categoryRowHeight * s, minWidth: 100 * s, paddingHorizontal: 26 * s, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background}}>
      <Text numberOfLines={1} style={{color: ink, fontSize: 25 * s, fontWeight: '600', lineHeight: 34 * s, includeFontPadding: false}}>{label}</Text>
      {selected && <View style={{position: 'absolute', height: 2 * s, bottom: 0, left: 12 * s, right: 12 * s, backgroundColor: c.text}}/>}
    </RowPressable>}
  </View>;
}
