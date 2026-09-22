import {useCallback, useEffect, useRef} from 'react';
import {AccessibilityInfo, Animated, BackHandler, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import type {Conversation} from './model';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';
import {useDrawerModalLock} from './DrawerGestureBoundary';
import {RowPressable} from '../../layout/RowPressable';
import {SettingsIcon, type SettingsIconName} from '../settings/SettingsIcon';
import {panelReference as g} from '../../layout/panelGeometry';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export interface HistoryMenuTarget {
  conversation: Conversation;
  bounds: {left: number; top: number; width: number; height: number};
}

export function HistoryActionMenu({target, scale: s, onClose, onSelect, onPin, onRename, onDelete}: {
  target: HistoryMenuTarget; scale: number;
  onClose: () => void; onSelect: () => void; onPin: () => void; onRename: () => void; onDelete: () => void;
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
  const panelTop = target.bounds.top + (Platform.OS === 'android' ? safe.top : 0);
  const minLeft = Math.max(safe.left, target.bounds.left) + inset;
  const maxRight = Math.min(width - safe.right, target.bounds.left + target.bounds.width) - inset;
  const minTop = Math.max(safe.top, panelTop) + inset;
  const maxBottom = Math.min(windowHeight - safe.bottom, panelTop + target.bounds.height) - inset;
  const menuWidth = Math.min(338 * s, Math.max(1, maxRight - minLeft));
  const height = Math.min((4 * g.rowHeight + 2 * g.groupPadding) * s, Math.max(1, maxBottom - minTop));
  // Keep a stable center height and align to the popup's right edge, regardless of the pressed row.
  const left = Math.max(minLeft, maxRight - menuWidth);
  const centeredTop = (safe.top + windowHeight - safe.bottom - height) / 2;
  const top = Math.max(minTop, Math.min(centeredTop, maxBottom - height));
  const actions: {label: string; icon: SettingsIconName; action: () => void; danger?: boolean}[] = [
    {label: '선택', icon: 'select', action: onSelect},
    {label: target.conversation.pinnedAt == null ? '고정' : '고정 해제', icon: 'pin', action: onPin},
    {label: '이름 변경', icon: 'edit', action: onRename},
    {label: '삭제', icon: 'delete', action: onDelete, danger: true},
  ];
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()} onShow={() => syncSystemBars(isDark)}>
  <View testID="history-actions-overlay" accessibilityViewIsModal style={{flex: 1}}>
    <Pressable testID="history-actions-dismiss" accessibilityRole="button" accessibilityLabel="채팅내역 메뉴 닫기" onPress={() => close()} style={StyleSheet.absoluteFill}/>
    <Animated.View testID="history-actions" accessibilityRole="menu" style={{position: 'absolute', left, top, width: menuWidth, paddingVertical: g.groupPadding * s, borderRadius: g.radius * s, backgroundColor: p.sheet,
      boxShadow: isDark ? '0px 6px 28px rgba(0,0,0,0.4)' : '0px 6px 28px rgba(0,0,0,0.15)', opacity: progress,
      transform: [{translateX: progress.interpolate({inputRange: [0, 1], outputRange: [8 * s, 0]})}, {scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
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
