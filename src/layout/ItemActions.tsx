import {useCallback, useEffect, useRef} from 'react';
import {AccessibilityInfo, Animated, BackHandler, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {syncSystemBars, useAppearance} from '../features/appearance/AppAppearance';
import {useDrawerModalLock} from '../features/chat/DrawerGestureBoundary';
import {RowPressable} from './RowPressable';
import {SettingsIcon, type SettingsIconName} from '../features/settings/SettingsIcon';
import {panelReference as g} from './panelGeometry';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {itemMenuGeometry, type MenuBounds} from './itemMenuGeometry';

export interface ItemMenuTarget {
  item: {id: string; title: string; pinnedAt?: number | null | undefined};
  bounds: MenuBounds;
  anchor: MenuBounds;
}
export interface ItemMenuAction {label: string; icon: SettingsIconName; action: () => void; danger?: boolean}

export function ItemActionMenu({target, scale: s, scope = 'history', onClose, onSelect, onPin, onRename, onDelete}: {
  target: ItemMenuTarget; scale: number; scope?: 'history' | 'card';
  onClose: () => void; onSelect: () => void; onPin: () => void; onRename: () => void; onDelete: () => void;
}) {
  return <AnchoredActionMenu target={target} scale={s} scope={scope} onClose={onClose} closeLabel={scope === 'card' ? '카드 메뉴 닫기' : '채팅내역 메뉴 닫기'} actions={[
    {label: '선택', icon: 'select', action: onSelect},
    {label: target.item.pinnedAt == null ? '고정' : '고정 해제', icon: 'pin', action: onPin},
    {label: '이름 변경', icon: 'edit', action: onRename},
    {label: '삭제', icon: 'delete', action: onDelete, danger: true},
  ]}/>;
}

/** Reuse the target origin, panel bounds and menu motion for list item actions. */
export function AnchoredActionMenu({target, scale: s, scope, closeLabel, actions, onClose}: {
  target: Pick<ItemMenuTarget, 'bounds' | 'anchor'>; scale: number; scope: string; closeLabel: string;
  actions: readonly ItemMenuAction[]; onClose: () => void;
}) {
  const {settings: p, colors: c, isDark} = useAppearance();
  const {width, height: windowHeight} = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const reduced = useRef(false);
  useDrawerModalLock();
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!mounted || closing.current) return;
      reduced.current = value;
      Animated.timing(progress, {toValue: 1, duration: value ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
    });
    return () => {mounted = false; progress.stopAnimation();};
  }, [progress]);
  const close = useCallback((action?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, {toValue: 0, duration: reduced.current ? 0 : 120, easing: Easing.in(Easing.quad), useNativeDriver: true}).start(({finished}) => {
      if (finished) {onClose(); action?.();}
    });
  }, [onClose, progress]);
  useEffect(() => {
    const native = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => {close(); return true;}) : undefined;
    if (Platform.OS !== 'web') return () => native?.remove();
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); event.stopImmediatePropagation(); close();}};
    document.addEventListener('keydown', escape, true);
    return () => {native?.remove(); document.removeEventListener('keydown', escape, true);};
  }, [close]);
  const inset = g.groupPadding * s;
  // Android's measured activity window excludes the status bar; this modal covers it.
  const windowOffset = Platform.OS === 'android' ? safe.top : 0;
  const {left, top, width: menuWidth, height, originX, originY} = itemMenuGeometry({
    panel: {...target.bounds, top: target.bounds.top + windowOffset},
    anchor: {...target.anchor, top: target.anchor.top + windowOffset},
    viewport: {left: safe.left, top: safe.top, width: width - safe.left - safe.right, height: windowHeight - safe.top - safe.bottom},
    width: 338 * s, height: (actions.length * g.rowHeight + 2 * g.groupPadding) * s, inset, gap: 8 * s,
  });
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()} onShow={() => syncSystemBars(isDark)}>
  <View testID={`${scope}-actions-overlay`} accessibilityViewIsModal style={{flex: 1}}>
    <Pressable testID={`${scope}-actions-dismiss`} accessibilityRole="button" accessibilityLabel={closeLabel} onPress={() => close()} style={StyleSheet.absoluteFill}/>
    <Animated.View testID={`${scope}-actions`} accessibilityRole="menu" style={{position: 'absolute', left, top, width: menuWidth, paddingVertical: g.groupPadding * s, borderRadius: g.radius * s, backgroundColor: p.sheet,
      boxShadow: isDark ? '0px 6px 28px rgba(0,0,0,0.4)' : '0px 6px 28px rgba(0,0,0,0.15)', opacity: progress,
      transformOrigin: [originX, originY, 0], transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
      <Pressable accessible={false} onPress={() => close()} style={StyleSheet.absoluteFill}/>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{maxHeight: Math.max(1, height - 2 * inset)}}>
      {actions.map(item => <RowPressable key={item.icon} accessibilityRole="menuitem" accessibilityLabel={item.label} onPress={() => close(item.action)} radius={g.controlRadius * s} highlightInset={g.highlightInset * s}
        contentStyle={{height: g.rowHeight * s, paddingHorizontal: g.rowInset * s, flexDirection: 'row', gap: 18 * s, alignItems: 'center'}}>
        <SettingsIcon name={item.icon} size={32 * s} color={item.danger ? c.error : p.text}/>
        <Text style={{color: item.danger ? c.error : p.text, fontSize: g.rowFont * s, lineHeight: g.rowLine * s, includeFontPadding: false}}>{item.label}</Text>
      </RowPressable>)}
      </ScrollView>
    </Animated.View>
  </View></Modal>;
}
