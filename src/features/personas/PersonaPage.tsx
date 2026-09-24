import {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Animated, FlatList, Keyboard, Pressable, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ListCreateButton, ListSearch} from '../../layout/ListSearch';
import {ItemRenameSheet} from '../../layout/ItemRenameSheet';
import {AnchoredActionMenu, type ItemMenuTarget} from '../../layout/ItemActions';
import type {MenuPoint} from '../../layout/itemMenuGeometry';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackBoundary, SwipeBackModal} from '../../layout/SwipeBackModal';
import {headerScale, referenceHeader, referenceTypography} from '../../layout/metrics';
import {useItemPresence, useItemReducedMotion} from '../../layout/itemListMotion';
import {selectionHaptic} from '../../layout/selectionHaptic';
import {panelReference as g} from '../../layout/panelGeometry';
import {useAppearance} from '../appearance/AppAppearance';
import {referenceSidebar as r} from '../chat/chatAppearance';
import {usePersonas} from './PersonaContext';
import {PersonaEditorSheet} from './PersonaEditorSheet';
import {PersonaDeleteDialog} from './PersonaDeleteDialog';
import {PersonaFolderSheet} from './PersonaFolderSheet';
import {PersonaFolderRow, PersonaParentRow, PersonaRow} from './PersonaLibraryRows';
import {PersonaSelectionBar, personaSelectionHeight} from './PersonaSelectionBar';
import {PersonaBreadcrumbs} from './PersonaBreadcrumbs';
import {libraryPersonas, nextPersonaFolderName, personaEntryOrder, personaFolderPath, type Persona, type PersonaFolder} from './personaPreferences';
import {personaEntryKey as entryKey, type PersonaEntry as Entry} from './personaLibrary';

type Deletion = {ids: string[]; folderIds: string[]; title: string; detail: string};
type Targets = {ids: string[]; folderIds: string[]};
type Organization = Targets & ({screen: 'choose'} | {screen: 'create'; name: string; parentId: string | null});
type Menu = Pick<ItemMenuTarget, 'bounds' | 'anchor' | 'point'> & {entry: Entry};

export function PersonaPage({onClose, folderId = null, onNavigateAncestor}: {onClose: () => void; folderId?: string | null; onNavigateAncestor?: (id: string | null) => void}) {
  const {value, ready, error: loadError, store} = usePersonas();
  const {colors: c} = useAppearance();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = headerScale(width);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{item?: Persona; revision: number; closing: boolean} | null>(null);
  const editorRevision = useRef(0);
  const [folder, setFolder] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const [organize, setOrganize] = useState<Organization | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [renaming, setRenaming] = useState<(PersonaFolder & {revision: number; closing: boolean}) | null>(null);
  const renameRevision = useRef(0);
  const panel = useRef<View>(null);
  const menuRequest = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; menuRequest.current++;};}, []);
  const reduced = useItemReducedMotion();
  const selection = useItemPresence(selected !== null, reduced);
  const allEntries: Entry[] = [...value.folders.map(item => ({kind: 'folder' as const, item})), ...value.items.map(item => ({kind: 'persona' as const, item}))];
  const selectedEntries = allEntries.filter(entry => selected?.has(entryKey(entry)));
  const obscured = (!!editor && !editor.closing) || !!folder || !!deletion || !!organize || !!menu || (!!renaming && !renaming.closing);
  const currentFolder = value.folders.find(item => item.id === folderId);
  const parentId = currentFolder?.parentId ?? null;
  const parentName = value.folders.find(item => item.id === parentId)?.name ?? '페르소나';
  const title = folderId === null ? '페르소나' : currentFolder?.name ?? '폴더';
  const footerBottom = insets.bottom + 10 * s;
  const ranks = new Map(personaEntryOrder(value).map((key, index) => [key, index]));
  const entries: Entry[] = [
    ...value.folders.filter(item => item.parentId === folderId && item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(item => ({kind: 'folder' as const, item})),
    ...libraryPersonas(value, folderId, search).map(item => ({kind: 'persona' as const, item})),
  ].sort((a, b) => (ranks.get(entryKey(a)) ?? 0) - (ranks.get(entryKey(b)) ?? 0));
  useEffect(() => {if (selected && selectedEntries.length === 0) setSelected(null);}, [selected, selectedEntries.length]);
  const openMenu = (entry: Entry, row: View, point?: MenuPoint) => {
    if (obscured) return;
    const request = ++menuRequest.current;
    Keyboard.dismiss(); selectionHaptic();
    panel.current?.measureInWindow((left, top, width, height) => {
      row.measureInWindow((rowLeft, rowTop, rowWidth, rowHeight) => {
        if (mounted.current && request === menuRequest.current && width > 0 && rowWidth > 0) {
          setMenu({entry, bounds: {left, top, width, height}, anchor: {left: rowLeft, top: rowTop, width: rowWidth, height: rowHeight}, ...(point ? {point} : {})});
        }
      });
    });
  };
  const selectEntry = (entry: Entry) => {Keyboard.dismiss(); selectionHaptic(); setSelected(current => new Set([...(current ?? []), entryKey(entry)]));};
  const navigateAncestor = (id: string | null) => {
    Keyboard.dismiss();
    if (id === folderId) {setFolder(null); setSelected(null);}
    else onNavigateAncestor?.(id);
  };
  const edit = (item?: Persona) => {Keyboard.dismiss(); setEditor({...(item ? {item} : {}), revision: ++editorRevision.current, closing: false});};
  const createFolder = (targets: Targets, parentId: string | null = folderId) => setOrganize({...targets, screen: 'create', parentId, name: nextPersonaFolderName(value.folders.filter(item => item.parentId === parentId))});
  const requestMove = (entries: Entry[]) => {
    if (!entries.length) return;
    Keyboard.dismiss();
    const targets = {ids: entries.filter(entry => entry.kind === 'persona').map(entry => entry.item.id), folderIds: entries.filter(entry => entry.kind === 'folder').map(entry => entry.item.id)};
    if (value.folders.length) setOrganize({...targets, screen: 'choose'});
    else createFolder(targets);
  };
  const menuEntries = menu ? (selected?.has(entryKey(menu.entry)) ? selectedEntries : [menu.entry]) : [];
  const requestDelete = (targets: Entry[]) => {
    if (!targets.length) return;
    Keyboard.dismiss();
    const ids = targets.filter(entry => entry.kind === 'persona').map(entry => entry.item.id);
    const folderIds = targets.filter(entry => entry.kind === 'folder').map(entry => entry.item.id);
    const subject = !folderIds.length ? '페르소나를' : !ids.length ? '폴더를' : '선택한 항목을';
    const detail = targets.length === 1 ? `“${targets[0]!.item.name}”` : `선택한 항목 ${targets.length}개가 삭제돼요.`;
    setDeletion({ids, folderIds, title: `${subject} 삭제할까요?`,
      detail: detail + (folderIds.length ? '\n폴더 안의 선택하지 않은 페르소나는 목록으로 옮겨져요.' : '')});
  };
  const press = (entry: Entry) => {
    if (obscured) return;
    if (selected) setSelected(current => {
      const next = new Set(current);
      const key = entryKey(entry);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next.size ? next : null;
    });
    else if (entry.kind === 'persona') edit(entry.item);
    else {Keyboard.dismiss(); setFolder(entry.item.id);}
  };
  return <SwipeBackModal onClose={onClose} active={!obscured} onBackRequest={() => {
    if (selected) {setSelected(null); return true;}
    if (!Keyboard.isVisible()) return false;
    Keyboard.dismiss(); return true;
  }}>{back => <>
    <SafeAreaView testID="persona-page" edges={['left', 'right']} style={{flex: 1, backgroundColor: c.drawer}} pointerEvents={obscured ? 'none' : 'auto'} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}>
      <View style={{paddingTop: insets.top + referenceHeader.barHeight * s, flex: 1}}>
        <View style={{width: '100%', maxWidth: g.contentMaxWidth, alignSelf: 'center', paddingHorizontal: g.inset * s}}>
        <View testID="persona-toolbar" style={{marginTop: (r.searchTop - referenceHeader.barHeight) * s, flexDirection: 'row', alignItems: 'center', gap: r.searchActionGap * s}}>
          <SwipeBackBoundary style={{flex: 1, minWidth: 0}}><ListSearch scale={s} value={search} onChange={setSearch} label="페르소나 검색" testID="persona-search"/></SwipeBackBoundary>
          {ready && <ListCreateButton scale={s} label="페르소나 생성" testID="persona-create" icon="plus" onPress={() => {setSelected(null); edit();}}/>}
        </View>
        <View style={{marginTop: 8 * s, marginBottom: 8 * s}}><PersonaBreadcrumbs path={personaFolderPath(value, folderId)} scale={s}
          onNavigate={id => {if (id === folderId) return; setSelected(null); if (id === parentId) back(); else navigateAncestor(id);}}/></View>
        </View>
        {!ready ? <View style={{padding: r.textInset * s}}>{loadError ? <RowPressable accessibilityRole="button" accessibilityLabel="페르소나 다시 불러오기" onPress={() => {void store?.load();}} radius={r.rowRadius * s} contentStyle={{padding: 20 * s}}><Text style={{color: c.error}}>{loadError}</Text></RowPressable> : <ActivityIndicator color={c.muted}/>}</View> : <View ref={panel} collapsable={false} style={{flex: 1}}>
          <FlatList removeClippedSubviews={false}
          testID="persona-list" data={entries} keyExtractor={entryKey} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {menuRequest.current++;}}
          getItemLayout={(_, index) => ({index, length: r.rowHeight * s, offset: (index + (folderId ? 1 : 0)) * r.rowHeight * s})}
          contentContainerStyle={{flexGrow: 1, paddingHorizontal: r.rowInset * s}}
          ListHeaderComponent={folderId ? <PersonaParentRow name={parentName} scale={s} onPress={back}/> : null}
          ListFooterComponentStyle={{flexGrow: 1}}
          ListFooterComponent={<Pressable testID="persona-selection-blank" accessibilityRole="button" accessibilityLabel="빈 공간 눌러 선택 해제" accessible={selected !== null} onPress={() => setSelected(null)} style={{flexGrow: 1, minHeight: 36 * s, paddingBottom: insets.bottom + 36 * s}}>
            <Animated.View pointerEvents="none" style={{height: selection.progress.interpolate({inputRange: [0, 1], outputRange: [0, (personaSelectionHeight + 18) * s]})}}/>
          </Pressable>}
          renderItem={({item: entry}) => entry.kind === 'folder'
            ? <PersonaFolderRow folder={entry.item} count={value.items.filter(item => item.folderId === entry.item.id).length + value.folders.filter(item => item.parentId === entry.item.id).length} scale={s}
              selected={selected?.has(entryKey(entry)) ?? false} selecting={selected !== null} selectionProgress={selection.progress}
              onPress={() => press(entry)} onMenu={(row, point) => openMenu(entry, row, point)}/>
            : <PersonaRow item={entry.item} scale={s} selected={selected?.has(entryKey(entry)) ?? false} selecting={selected !== null} selectionProgress={selection.progress}
              onPress={() => press(entry)} onMenu={(row, point) => openMenu(entry, row, point)}/>}
          ListEmptyComponent={<Text style={{paddingHorizontal: (r.textInset - r.rowInset) * s, paddingVertical: 24 * s, color: c.muted, fontSize: 24 * s}}>{search.trim() ? '검색 결과가 없어요.' : '아직 페르소나가 없어요.'}</Text>}/>
        </View>
        }
      </View>
      <View pointerEvents="box-none" style={{position: 'absolute', top: insets.top, left: 0, right: 0}}><ScreenHeader width={width} topInset={insets.top} surfaceColor={c.drawer}>
        <HeaderButton width={width} icon="back" label={folderId ? '페르소나 목록으로 돌아가기' : '페르소나 닫기'} onPress={back}/>
        <View pointerEvents="none" style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}><Text accessibilityRole="header" numberOfLines={1} style={{color: c.text, fontSize: referenceHeader.titleFont * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{title}</Text></View>
        <View pointerEvents="none" style={{width: referenceHeader.height * s}}/>
      </ScreenHeader></View>
      <PersonaSelectionBar count={selectedEntries.length} canMove={selectedEntries.length > 0} progress={selection.progress} present={selection.present} scale={s} bottom={footerBottom}
        onCancel={() => setSelected(null)}
        onFolder={() => requestMove(selectedEntries)}
        onDelete={() => requestDelete(selectedEntries)}/>
    </SafeAreaView>
    {menu && <AnchoredActionMenu target={menu} scale={s} scope="persona" anchorWindow="modal" closeLabel="페르소나 메뉴 닫기" onClose={() => {menuRequest.current++; setMenu(null);}} actions={[
      {label: selected?.has(entryKey(menu.entry)) ? '선택 해제' : '선택', icon: 'select', action: () => {
        if (selected?.has(entryKey(menu.entry))) setSelected(current => {const next = new Set(current); next.delete(entryKey(menu.entry)); return next.size ? next : null;});
        else selectEntry(menu.entry);
      }},
      {label: '폴더 이동', icon: 'folder', action: () => requestMove(menuEntries)},
      {label: menu.entry.kind === 'folder' ? '이름 변경' : '페르소나 편집', icon: 'edit', action: () => {
        if (menu.entry.kind === 'folder') setRenaming({...menu.entry.item, revision: ++renameRevision.current, closing: false});
        else edit(menu.entry.item);
      }},
      {label: '삭제', icon: 'delete', danger: true, action: () => requestDelete(menuEntries)},
    ]}/>}
    {renaming && store && <ItemRenameSheet key={renaming.revision} scope="persona-folder" item={{title: renaming.name}} inputLabel="폴더 이름" maxLength={40}
      onDismissStart={() => setRenaming(current => current?.revision === renaming.revision ? {...current, closing: true} : current)}
      onClose={() => setRenaming(current => current?.revision === renaming.revision ? null : current)} onSave={name => store.renameFolder(renaming.id, name)}/>}
    {deletion && store && <PersonaDeleteDialog title={deletion.title} detail={deletion.detail}
      onClose={() => {setDeletion(null); setSelected(null);}} onDelete={() => store.removeMany(deletion.ids, deletion.folderIds)}/>}
    {organize?.screen === 'choose' && store && <PersonaFolderSheet ids={organize.ids} folderIds={organize.folderIds} initialFolderId={folderId} value={value} store={store} onClose={() => setOrganize(null)}
      onMoved={() => setSelected(null)}/>}
    {organize?.screen === 'create' && store && <ItemRenameSheet scope="persona-folder" item={{title: organize.name}} heading="새 폴더" inputLabel="폴더 이름" maxLength={40}
      onClose={() => setOrganize(null)} onSave={async name => {await store.createFolder(name, organize.ids, organize.parentId, organize.folderIds); setSelected(null);}}/>}
    {editor && store && <PersonaEditorSheet key={editor.revision} {...(editor.item ? {item: editor.item} : {})} folderId={folderId} store={store}
      onDismissStart={() => setEditor(current => current?.revision === editor.revision ? {...current, closing: true} : current)}
      onClose={() => setEditor(current => current?.revision === editor.revision ? null : current)} onCreated={() => setSearch('')}/>}
    {folder && <PersonaPage folderId={folder} onClose={() => setFolder(null)} onNavigateAncestor={navigateAncestor}/>}
  </>}</SwipeBackModal>;
}
