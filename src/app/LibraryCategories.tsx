import {useEffect, useRef, useState} from 'react';
import {ScrollView, Text, View, useWindowDimensions} from 'react-native';
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

export const categoryRowHeight = 84;

export function LibraryCategories({library, value, selected, onSelect, onRemove, scale: s, active}: {
  library: FolderLibrary; value: FolderTree; selected: string | null; onSelect: (id: string | null) => void;
  onRemove: (id: string) => Promise<void>; scale: number; active: boolean;
}) {
  const {colors: c, isDark} = useAppearance();
  const {width, height} = useWindowDimensions(), safe = useSafeAreaInsets();
  const [menu, setMenu] = useState<(Pick<ItemMenuTarget, 'bounds' | 'anchor'> & {folder: LibraryFolder}) | null>(null);
  const [editing, setEditing] = useState<{id: string | null; title: string} | null>(null);
  const [deleting, setDeleting] = useState<LibraryFolder | null>(null);
  const resetChrome = useCollectionChrome()?.reset;
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
    <PagingBoundary>{scrollEvents => <ScrollView {...scrollEvents} horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} testID="library-categories" directionalLockEnabled
      contentContainerStyle={{alignItems: 'center', gap: 12 * s, paddingHorizontal: panelReference.inset * s, height: categoryRowHeight * s}}>
      <CategoryPill label="전체" selected={selected === null} scale={s} onPress={() => choose(null)}/>
      {value.folders.map(folder => <CategoryPill key={folder.id} label={folderPath(value, folder.id).map(item => item.name).join(' › ')}
        selected={folder.id === selected} scale={s} onPress={() => choose(folder.id)} onLongPress={row => openMenu(folder, row)}/>)}
      <RowPressable accessibilityRole="button" accessibilityLabel="새 분류 만들기" testID="library-category-add" onPress={create} radius={36 * s}
        contentStyle={{width: 70 * s, height: 66 * s, borderRadius: 36 * s, backgroundColor: isDark ? c.background : '#F2F2F2',
          borderWidth: isDark ? 1 : 0, borderColor: c.divider, alignItems: 'center', justifyContent: 'center'}}>
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

function CategoryPill({label, selected, scale: s, onPress, onLongPress}: {
  label: string; selected: boolean; scale: number; onPress: () => void; onLongPress?: (row: View) => void;
}) {
  const {colors: c, isDark} = useAppearance();
  const row = useRef<View>(null);
  const ink = selected ? isDark ? '#151515' : '#FFFFFF' : c.text;
  return <View ref={row} collapsable={false}>
    <RowPressable accessibilityRole="button" accessibilityLabel={`${label} 분류`} accessibilityState={{selected}}
      {...(onLongPress ? {accessibilityHint: '길게 눌러 분류 관리', accessibilityActions: [{name: 'longpress', label: '분류 관리'}],
        onAccessibilityAction: (event: {nativeEvent: {actionName: string}}) => {if (event.nativeEvent.actionName === 'longpress' && row.current) onLongPress(row.current);},
        onLongPress: () => {if (row.current) onLongPress(row.current);}, delayLongPress: 420} : {})}
      onPress={onPress} radius={36 * s} contentStyle={{height: 66 * s, paddingHorizontal: 28 * s, justifyContent: 'center', borderRadius: 36 * s,
        backgroundColor: selected ? isDark ? '#F4F4F4' : '#191919' : isDark ? c.background : '#F2F2F2',
        borderWidth: isDark && !selected ? 1 : 0, borderColor: c.divider}}>
      <Text numberOfLines={1} style={{color: ink, fontSize: 25 * s, fontWeight: '600', lineHeight: 34 * s, includeFontPadding: false}}>{label}</Text>
    </RowPressable>
  </View>;
}
