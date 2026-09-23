import {useRef, useState} from 'react';
import {ActivityIndicator, FlatList, Keyboard, Text, View, useWindowDimensions} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ListCreateButton, ListSearch} from '../../layout/ListSearch';
import {AnchoredActionMenu, type ItemMenuTarget} from '../../layout/ItemActions';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {RowPressable} from '../../layout/RowPressable';
import {SwipeBackBoundary, SwipeBackModal} from '../../layout/SwipeBackModal';
import {headerScale, referenceHeader, referenceTypography} from '../../layout/metrics';
import {useItemPresence, useItemReducedMotion} from '../../layout/itemListMotion';
import {useAppearance} from '../appearance/AppAppearance';
import {referenceSidebar as r} from '../chat/chatAppearance';
import {UserAvatar} from '../profile/UserAvatar';
import {SettingsIcon} from '../settings/SettingsIcon';
import {usePersonas} from './PersonaContext';
import {PersonaEditorSheet} from './PersonaEditorSheet';
import {searchPersonas, type Persona} from './personaPreferences';

export function PersonaPage({onClose}: {onClose: () => void}) {
  const {value, ready, error: loadError, store} = usePersonas();
  const {colors: c} = useAppearance();
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = headerScale(width);
  const panel = useRef<View>(null);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{item?: Persona} | null>(null);
  const [menu, setMenu] = useState<{item: Persona; target: ItemMenuTarget} | null>(null);
  const [error, setError] = useState('');
  const obscured = editor !== null || menu !== null;
  const report = () => setError('변경 내용을 저장하지 못했어요. 다시 시도해 주세요.');
  const run = (work: Promise<unknown>) => {setError(''); void work.catch(report);};
  const showMenu = (item: Persona, row: View) => {
    Keyboard.dismiss();
    row.measureInWindow((left, top, rowWidth, height) => panel.current?.measureInWindow((x, y, panelWidth, panelHeight) => {
      setMenu({item, target: {item: {id: item.id, title: item.name}, anchor: {left, top, width: rowWidth, height}, bounds: {left: x, top: y, width: panelWidth, height: panelHeight}}});
    }));
  };
  const edit = (item?: Persona) => {Keyboard.dismiss(); setError(''); setEditor(item ? {item} : {});};
  return <SwipeBackModal onClose={onClose} active={!obscured} onBackRequest={() => {
    if (!Keyboard.isVisible()) return false;
    Keyboard.dismiss(); return true;
  }}>{back => <>
    <SafeAreaView ref={panel} collapsable={false} testID="persona-page" edges={['left', 'right']} style={{flex: 1, backgroundColor: c.drawer}} pointerEvents={obscured ? 'none' : 'auto'} accessibilityElementsHidden={obscured} importantForAccessibility={obscured ? 'no-hide-descendants' : 'auto'}>
      <View style={{paddingTop: insets.top + referenceHeader.barHeight * s, flex: 1}}>
        <View testID="persona-toolbar" style={{marginTop: (r.searchTop - referenceHeader.barHeight) * s, marginHorizontal: r.searchLeft * s, marginBottom: r.listGap * s, flexDirection: 'row', alignItems: 'center', gap: r.searchActionGap * s}}>
          <SwipeBackBoundary style={{flex: 1, minWidth: 0}}><ListSearch scale={s} value={search} onChange={setSearch} label="페르소나 검색" testID="persona-search"/></SwipeBackBoundary>
          {ready && <ListCreateButton scale={s} label="페르소나 생성" testID="persona-create" icon="plus" onPress={() => edit()}/>}
        </View>
        {!ready ? <View style={{padding: r.textInset * s}}>{loadError ? <RowPressable accessibilityRole="button" accessibilityLabel="페르소나 다시 불러오기" onPress={() => {void store?.load();}} radius={r.rowRadius * s} contentStyle={{padding: 20 * s}}><Text style={{color: c.error}}>{loadError}</Text></RowPressable> : <ActivityIndicator color={c.muted}/>}</View> : <FlatList
          testID="persona-list" data={searchPersonas(value.items, search)} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: r.rowInset * s, paddingBottom: insets.bottom + 36 * s}}
          renderItem={({item}) => <PersonaRow item={item} scale={s} selected={value.selectedId === item.id} onSelect={() => {Keyboard.dismiss(); if (store) run(store.select(item.id));}} onMenu={row => showMenu(item, row)}/>}
          ListEmptyComponent={<Text style={{paddingHorizontal: (r.textInset - r.rowInset) * s, paddingVertical: 24 * s, color: c.muted, fontSize: 24 * s}}>{search.trim() ? '검색 결과가 없어요.' : '아직 페르소나가 없어요.'}</Text>}/>
        }
        {!!error && <Text accessibilityRole="alert" style={{color: c.error, fontSize: 22 * s, marginHorizontal: r.textInset * s, marginBottom: insets.bottom + 16 * s}}>{error}</Text>}
      </View>
      <View pointerEvents="box-none" style={{position: 'absolute', top: insets.top, left: 0, right: 0}}><ScreenHeader width={width} topInset={insets.top} surfaceColor={c.drawer}>
        <HeaderButton width={width} icon="back" label="페르소나 닫기" onPress={back}/>
        <View pointerEvents="none" style={{flex: 1, height: referenceHeader.height * s, justifyContent: 'center', alignItems: 'center'}}><Text accessibilityRole="header" style={{color: c.text, fontSize: referenceHeader.titleFont * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>페르소나</Text></View>
        <View pointerEvents="none" style={{width: referenceHeader.height * s}}/>
      </ScreenHeader></View>
    </SafeAreaView>
    {menu && store && <AnchoredActionMenu target={menu.target} scale={s} scope="persona" closeLabel="페르소나 메뉴 닫기" onClose={() => setMenu(null)} actions={[
      {label: '편집', icon: 'edit', action: () => edit(menu.item)},
      {label: '복제', icon: 'copy', action: () => run(store.duplicate(menu.item.id).then(item => {setSearch(''); edit(item);}))},
      {label: '삭제', icon: 'delete', danger: true, action: () => run(store.remove(menu.item.id))},
    ]}/>}
    {editor && store && <PersonaEditorSheet {...(editor.item ? {item: editor.item} : {})} store={store} onClose={() => setEditor(null)} onCreated={() => setSearch('')}/>}
  </>}</SwipeBackModal>;
}

function PersonaRow({item, selected, scale: s, onSelect, onMenu}: {item: Persona; selected: boolean; scale: number; onSelect: () => void; onMenu: (row: View) => void}) {
  const {colors: c} = useAppearance();
  const row = useRef<View>(null);
  const reduced = useItemReducedMotion();
  const {progress} = useItemPresence(selected, reduced, true);
  const menu = () => {if (row.current) onMenu(row.current);};
  return <View ref={row} collapsable={false}><RowPressable testID={`persona-row-${item.id}`} accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{checked: selected}} accessibilityHint="길게 눌러 편집, 복제, 삭제" accessibilityActions={[{name: 'longpress', label: '페르소나 메뉴'}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'longpress') menu();}}
    selected={selected} selectionProgress={progress} selectedHighlight="pressed" radius={r.rowRadius * s} onPress={onSelect} onLongPress={menu} delayLongPress={420}
    contentStyle={{height: r.rowHeight * s, paddingHorizontal: (r.textInset - r.rowInset) * s, flexDirection: 'row', alignItems: 'center', gap: r.cardImageGap * s}}>
    <UserAvatar image={item.image} size={r.cardImage * s}/>
    <View style={{flex: 1, minWidth: 0}}><Text numberOfLines={1} style={{color: c.text, fontSize: r.fontSize * s, lineHeight: r.lineHeight * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{item.name}</Text>
      {!!item.description && <Text numberOfLines={1} style={{color: c.muted, fontSize: 20 * s, lineHeight: 27 * s, includeFontPadding: false}}>{item.description}</Text>}
    </View>
    <View style={{width: 30 * s}}>{selected && <SettingsIcon name="check" size={28 * s} color={c.text}/>}</View>
  </RowPressable></View>;
}
