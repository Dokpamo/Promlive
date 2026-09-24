import {SelectionMark} from '../library/SelectionMark';
import {useRef} from 'react';
import {Animated, Text, View, type GestureResponderEvent} from 'react-native';
import type {MenuPoint} from '../../layout/itemMenuGeometry';
import {RowPressable} from '../../layout/RowPressable';
import {useItemPresence, useItemReducedMotion} from '../../layout/itemListMotion';
import {referenceTypography} from '../../layout/metrics';
import {useAppearance} from '../appearance/AppAppearance';
import {referenceSidebar as r} from '../chat/chatAppearance';
import {UserAvatar} from '../profile/UserAvatar';
import {SettingsIcon} from '../settings/SettingsIcon';
import type {Persona, PersonaFolder} from './personaPreferences';

export function PersonaRow({item, selected, selecting, selectionProgress, scale: s, onPress, onMenu}: {
  item: Persona; selected: boolean; selecting: boolean; selectionProgress: Animated.Value; scale: number;
  onPress: () => void; onMenu: (row: View, point?: MenuPoint) => void;
}) {
  const {colors: c} = useAppearance();
  const reduced = useItemReducedMotion();
  const {progress} = useItemPresence(selected, reduced, true);
  const row = useRef<View>(null);
  const openMenu = (event?: GestureResponderEvent) => {
    const touch = event?.nativeEvent;
    if (row.current) onMenu(row.current, touch ? {x: touch.pageX, y: touch.pageY} : undefined);
  };
  return <View ref={row} collapsable={false}><RowPressable testID={`persona-row-${item.id}`} accessibilityRole={selecting ? 'checkbox' : 'button'} accessibilityLabel={item.name}
    accessibilityState={selecting ? {checked: selected} : {}} accessibilityHint={selecting ? '눌러서 선택 변경, 길게 눌러 메뉴 열기' : '눌러서 편집, 길게 눌러 메뉴 열기'}
    accessibilityActions={[{name: 'longpress', label: '메뉴 열기'}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'longpress') openMenu();}}
    selected={selected} selectionProgress={progress} selectedHighlight="pressed" radius={r.rowRadius * s} onPress={onPress} onLongPress={openMenu} delayLongPress={420}
    contentStyle={{height: r.rowHeight * s, paddingHorizontal: (r.textInset - r.rowInset) * s, flexDirection: 'row', alignItems: 'center'}}>
    <View style={{marginRight: r.cardImageGap * s}}><UserAvatar image={item.image} size={r.cardImage * s}/></View>
    <View style={{flex: 1, minWidth: 0}}><Text numberOfLines={1} style={{color: c.text, fontSize: r.fontSize * s, lineHeight: r.lineHeight * s, fontWeight: referenceTypography.titleWeight, includeFontPadding: false}}>{item.name}</Text>
      {!!item.description && <Text numberOfLines={1} style={{color: c.muted, fontSize: 20 * s, lineHeight: 27 * s, includeFontPadding: false}}>{item.description}</Text>}
    </View>
    <SelectionMark scale={s} selectionProgress={selectionProgress} checkedProgress={progress}/>
  </RowPressable></View>;
}

export function PersonaFolderRow({folder, count, selected, selecting, selectionProgress, scale: s, onPress, onMenu}: {
  folder: PersonaFolder; count: number; selected: boolean; selecting: boolean; selectionProgress: Animated.Value;
  scale: number; onPress: () => void; onMenu: (row: View, point?: MenuPoint) => void;
}) {
  const {colors: c} = useAppearance();
  const reduced = useItemReducedMotion();
  const {progress} = useItemPresence(selected, reduced, true);
  const row = useRef<View>(null);
  const openMenu = (event?: GestureResponderEvent) => {
    const touch = event?.nativeEvent;
    if (row.current) onMenu(row.current, touch ? {x: touch.pageX, y: touch.pageY} : undefined);
  };
  return <View ref={row} collapsable={false}><RowPressable testID={`persona-folder-${folder.id}`} accessibilityRole={selecting ? 'checkbox' : 'button'} accessibilityLabel={`${folder.name} 폴더`} accessibilityValue={{text: `${count}개`}}
    accessibilityState={selecting ? {checked: selected} : {}} accessibilityHint={selecting ? '눌러서 선택 변경, 길게 눌러 메뉴 열기' : '눌러서 열기, 길게 눌러 메뉴 열기'}
    accessibilityActions={[{name: 'longpress', label: '메뉴 열기'}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'longpress') openMenu();}}
    selected={selected} selectionProgress={progress} selectedHighlight="pressed" radius={r.rowRadius * s} onPress={onPress} onLongPress={openMenu} delayLongPress={420}
    contentStyle={{height: r.rowHeight * s, paddingHorizontal: (r.textInset - r.rowInset) * s, flexDirection: 'row', alignItems: 'center'}}>
    <View style={{width: r.cardImage * s, marginRight: r.cardImageGap * s, alignItems: 'center'}}><SettingsIcon name="folder" size={38 * s} color={c.text}/></View>
    <Text numberOfLines={1} style={{flex: 1, color: c.text, fontSize: r.fontSize * s, fontWeight: referenceTypography.titleWeight}}>{folder.name}</Text>
    <Text style={{color: c.muted, fontSize: 24 * s, marginLeft: r.cardImageGap * s}}>{count}</Text>
    <Animated.View pointerEvents="none" style={{width: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [42 * s, 0]}), opacity: selectionProgress.interpolate({inputRange: [0, 1], outputRange: [1, 0]}), alignItems: 'flex-end', overflow: 'hidden'}}><SettingsIcon name="chevron" size={24 * s} color={c.muted}/></Animated.View>
    <SelectionMark scale={s} selectionProgress={selectionProgress} checkedProgress={progress}/>
  </RowPressable></View>;
}

export function PersonaParentRow({name, scale: s, onPress}: {name: string; scale: number; onPress: () => void}) {
  const {colors: c} = useAppearance();
  return <RowPressable testID="persona-parent-folder" accessibilityRole="button" accessibilityLabel={`상위 폴더, ${name}`} onPress={onPress}
    radius={r.rowRadius * s}
    contentStyle={{height: r.rowHeight * s, paddingHorizontal: (r.textInset - r.rowInset) * s, flexDirection: 'row', alignItems: 'center', gap: r.cardImageGap * s}}>
    <View style={{width: r.cardImage * s, alignItems: 'center', transform: [{rotate: '-90deg'}]}}><SettingsIcon name="chevron" size={30 * s} color={c.muted}/></View>
    <Text numberOfLines={1} style={{flex: 1, color: c.muted, fontSize: r.fontSize * s}}>{name}</Text>
  </RowPressable>;
}
