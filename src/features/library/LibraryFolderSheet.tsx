import {useEffect, useRef, useState} from 'react';
import {Animated, Text, View, useWindowDimensions} from 'react-native';
import {ItemRenameSheet} from '../../layout/ItemRenameSheet';
import {PressSurface} from '../../layout/PressSurface';
import {RowPressable} from '../../layout/RowPressable';
import {panelReference as g} from '../../layout/panelGeometry';
import {useAppearance} from '../appearance/AppAppearance';
import {useDrawerModalLock} from '../chat/DrawerGestureBoundary';
import {ChatIcon} from '../chat/ChatIcon';
import {SettingsIcon} from '../settings/SettingsIcon';
import {SettingsSheet, useSettingsScale} from '../settings/SettingsLayout';
import {FolderBreadcrumbs} from './FolderBreadcrumbs';
import {canMoveFolders, nextFolderName, folderPath, type FolderTree} from './folderTree';
import type {FolderActions} from './FolderLibrary';
import {useFolderNavigation} from './useFolderNavigation';

/** One destination picker serves the item menu and the selection bar. */
export function LibraryFolderSheet({ids, folderIds, initialFolderId, value, store, onClose, onMoved, scope = 'persona', rootName = '페르소나'}: {
  ids: string[]; folderIds: string[]; value: FolderTree & {order?: string[]}; store: FolderActions; scope?: string; rootName?: string;
  initialFolderId: string | null;
  onClose: () => void; onMoved: () => void;
}) {
  const {settings: p, colors: c, isDark} = useAppearance();
  const s = useSettingsScale();
  const {width} = useWindowDimensions();
  const [creating, setCreating] = useState<{name: string; parentId: string | null} | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const moved = useRef(false);
  const namingOpen = useRef(false);
  const mounted = useRef(false);
  useDrawerModalLock();
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const blocked = busy || !!creating || dismissing;
  const navigation = useFolderNavigation({value, initialFolderId, blocked,
    canVisit: id => canMoveFolders(value, folderIds, id), width: Math.min(560, width - 2 * g.sheetInset * s)});
  const {folderId} = navigation;
  // Selected descendants travel with their parent; only independent roots move.
  const locations = [
    ...value.items.filter(item => ids.includes(item.id) && canMoveFolders(value, folderIds, item.folderId)).map(item => item.folderId),
    ...value.folders.filter(item => folderIds.includes(item.id) && canMoveFolders(value, folderIds, item.parentId)).map(item => item.parentId),
  ];
  const canMove = canMoveFolders(value, folderIds, folderId) && locations.some(id => id !== folderId);
  const ranks = new Map((value.order ?? value.folders.map(folder => `folder:${folder.id}`)).map((key, index) => [key, index]));
  const navigate = (id: string | null) => {
    if (pending.current || moved.current || blocked) return;
    navigation.navigate(id); setError('');
  };
  const move = async (close: () => void) => {
    if (pending.current || moved.current || blocked || navigation.dragging || !canMove) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await store.move(ids, folderId, folderIds);
      if (mounted.current) {moved.current = true; close();}
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '폴더로 옮기지 못했어요. 다시 시도해 주세요.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const renderFolder = (id: string | null, interactive: boolean) => {
    const currentFolder = value.folders.find(folder => folder.id === id);
    const parentName = value.folders.find(folder => folder.id === currentFolder?.parentId)?.name ?? rootName;
    const destinations = value.folders.filter(folder => folder.parentId === id && canMoveFolders(value, folderIds, folder.id))
      .sort((a, b) => (ranks.get(`folder:${a.id}`) ?? 0) - (ranks.get(`folder:${b.id}`) ?? 0));
    const disabled = blocked || navigation.dragging || !interactive;
    return <View onLayout={event => {const height = event.nativeEvent.layout.height; setPageHeight(old => Math.max(old, height));}}>
      {currentFolder && <RowPressable accessibilityRole="button" accessibilityLabel={`이동 위치, 상위 폴더 ${parentName} 열기`} disabled={disabled}
        onPress={() => navigate(currentFolder.parentId)} radius={g.controlRadius * s} highlightInset={g.highlightInset * s}
        contentStyle={{height: g.rowHeight * s, paddingHorizontal: g.rowInset * s, flexDirection: 'row', alignItems: 'center', gap: 18 * s}}>
        <View style={{transform: [{rotate: '-90deg'}]}}><SettingsIcon name="chevron" size={32 * s} color={p.text}/></View><Text numberOfLines={1} style={{flex: 1, color: p.text, fontSize: g.rowFont * s}}>{parentName}</Text>
      </RowPressable>}
      <RowPressable accessibilityRole="button" accessibilityLabel="새 폴더" disabled={disabled || !canMoveFolders(value, folderIds, id)} onPress={() => {
        if (pending.current || moved.current || disabled) return;
        namingOpen.current = true;
        setCreating({parentId: id, name: nextFolderName(value.folders.filter(folder => folder.parentId === id))});
      }} radius={g.controlRadius * s} highlightInset={g.highlightInset * s}
        contentStyle={{height: g.rowHeight * s, paddingHorizontal: g.rowInset * s, flexDirection: 'row', alignItems: 'center', gap: 18 * s}}>
        <ChatIcon name="plus" size={32 * s} color={p.text}/><Text style={{color: p.text, fontSize: g.rowFont * s}}>새 폴더</Text>
      </RowPressable>
      {destinations.map(destination => <RowPressable key={destination.id} accessibilityRole="button" accessibilityLabel={`이동 위치, ${destination.name} 폴더 열기`}
          disabled={disabled} onPress={() => navigate(destination.id)} radius={g.controlRadius * s} highlightInset={g.highlightInset * s}
          contentStyle={{minHeight: g.rowHeight * s, paddingVertical: g.rowPadding * s, paddingHorizontal: g.rowInset * s, flexDirection: 'row', alignItems: 'center', gap: 18 * s}}>
          <SettingsIcon name="folder" size={32 * s} color={p.text}/><Text style={{flex: 1, color: p.text, fontSize: g.rowFont * s, lineHeight: g.rowLine * s}}>{destination.name}</Text>
          <SettingsIcon name="chevron" size={24 * s} color={p.faint}/>
        </RowPressable>)}
    </View>;
  };
  return <SettingsSheet title="폴더" contentKey={folderId} horizontalDrag={navigation.drag} onBackRequest={navigation.back}
    dismiss={dismissing} obscured={!!creating} overlay={creating && <ItemRenameSheet scope={`${scope}-folder`} item={{title: creating.name}} heading="새 폴더" inputLabel="폴더 이름" maxLength={40}
      onClose={() => {namingOpen.current = false; setCreating(null); if (moved.current) setDismissing(true);}}
      onSave={async name => {
        pending.current = true; setBusy(true); setError('');
        try {
          await store.createFolder(name, ids, creating.parentId, folderIds);
          if (mounted.current) {
            moved.current = true;
            // The user may close the editor while storage is still completing.
            if (!namingOpen.current) setDismissing(true);
          }
        } catch (cause) {
          if (mounted.current && !namingOpen.current) setError(cause instanceof Error ? cause.message : '폴더를 만들지 못했어요. 다시 시도해 주세요.');
          throw cause;
        } finally {
          pending.current = false;
          if (mounted.current) setBusy(false);
        }
      }}/>} onClose={() => {
    onClose();
    if (moved.current) onMoved();
  }} footer={close => <>
    {!!error && <Text accessibilityRole="alert" style={{color: c.error, fontSize: 22 * s, marginBottom: 16 * s}}>{error}</Text>}
    <PressSurface accessibilityRole="button" accessibilityLabel="여기로 이동" accessibilityState={{disabled: blocked || navigation.dragging || !canMove, busy}}
      disabled={blocked || navigation.dragging || !canMove} onPress={() => {void move(close);}} radius={g.controlRadius * s} highlightColor={p.selected}
      style={{alignSelf: 'center', height: 78 * s, minWidth: 232 * s, maxWidth: '100%'}}
      contentStyle={{backgroundColor: p.sheet, boxShadow: isDark ? '0px 3px 16px rgba(0,0,0,0.24)' : '0px 3px 16px rgba(0,0,0,0.07)', paddingHorizontal: 28 * s, alignItems: 'center', justifyContent: 'center'}}>
      <Text numberOfLines={1} style={{color: p.text, fontSize: g.rowFont * s, lineHeight: g.rowLine * s, includeFontPadding: false}}>{busy ? '이동 중' : '여기로 이동'}</Text>
    </PressSurface>
  </>}>{() => <View testID={`${scope}-folder-picker`}>
    <FolderBreadcrumbs path={folderPath(value, folderId)} scale={s} onNavigate={navigate} disabled={blocked || navigation.dragging}
      labelPrefix="이동 위치, " rootName={rootName} testID={`${scope}-folder-picker-path`}/>
    <View testID={`${scope}-folder-pages`} style={{marginHorizontal: -g.sheetPadding * s, overflow: 'hidden', minHeight: pageHeight}}>
      {navigation.transition ? <>
        <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[{position: 'absolute', top: 0, left: 0, right: 0}, navigation.outgoing]}>{renderFolder(navigation.transition.from, false)}</Animated.View>
        <Animated.View pointerEvents={navigation.dragging ? 'none' : 'auto'} style={navigation.incoming}>
          {renderFolder(navigation.transition.to, folderId === navigation.transition.to)}
        </Animated.View>
      </> : renderFolder(folderId, true)}
    </View>
  </View>}</SettingsSheet>;
}
