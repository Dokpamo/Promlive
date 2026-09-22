import {useCallback, useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, BackHandler, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions} from 'react-native';
import type {Conversation} from './model';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';
import {useDrawerModalLock} from './DrawerGestureBoundary';
import {SettingsPressable} from '../settings/SettingsPressable';
import {SettingsIcon, type SettingsIconName} from '../settings/SettingsIcon';
import {settingsReference as g} from '../settings/settingsGeometry';
import {headerScale} from './chatAppearance';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export interface HistoryMenuTarget {conversation: Conversation; left: number; top: number; width: number; height: number}

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
  const menuWidth = Math.min(338 * s, target.width - 2 * inset, width - safe.left - safe.right - 2 * inset);
  const height = Math.min((4 * g.rowHeight + 2 * g.groupPadding) * s, Math.max(1, windowHeight - safe.top - safe.bottom - 2 * inset));
  const left = Math.max(safe.left + inset, Math.min(target.left + inset, width - safe.right - inset - menuWidth));
  const minTop = safe.top + inset;
  // Android's measured activity window excludes the status bar; this modal covers it.
  const anchorTop = target.top + (Platform.OS === 'android' ? safe.top : 0);
  const above = anchorTop - height - inset;
  const proposed = above >= minTop ? above : anchorTop + target.height + inset;
  const top = Math.max(minTop, Math.min(proposed, windowHeight - safe.bottom - height - inset));
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
      transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [above >= minTop ? 6 : -6, 0]})}, {scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
      <Pressable accessible={false} onPress={() => close()} style={StyleSheet.absoluteFill}/>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{maxHeight: Math.max(1, height - 2 * inset)}}>
      {actions.map(item => <SettingsPressable key={item.icon} accessibilityRole="menuitem" accessibilityLabel={item.label} onPress={() => close(item.action)} radius={g.controlRadius * s} highlightInset={g.highlightInset * s}
        contentStyle={{height: g.rowHeight * s, paddingHorizontal: g.rowInset * s, flexDirection: 'row', gap: 18 * s, alignItems: 'center'}}>
        <SettingsIcon name={item.icon} size={32 * s} color={item.danger ? c.error : p.text}/>
        <Text style={{color: item.danger ? c.error : p.text, fontSize: g.rowFont * s, lineHeight: g.rowLine * s, includeFontPadding: false}}>{item.label}</Text>
      </SettingsPressable>)}
      </ScrollView>
    </Animated.View>
  </View></Modal>;
}

export function HistoryRenameDialog({conversation, onClose, onSave}: {conversation: Conversation; onClose: () => void; onSave: (title: string) => Promise<void>}) {
  const {settings: p, colors: c, isDark} = useAppearance();
  const {width} = useWindowDimensions();
  const s = headerScale(width);
  const [title, setTitle] = useState(conversation.title);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const input = useRef<TextInput>(null);
  const mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useDrawerModalLock();
  const save = async () => {
    if (pending.current || !title.trim()) return;
    pending.current = true; setSaving(true);
    try {await onSave(title.trim()); onClose();}
    catch (failure) {if (mounted.current) setError(failure instanceof Error ? failure.message : '이름을 저장하지 못했어요.');}
    finally {pending.current = false; if (mounted.current) setSaving(false);}
  };
  return <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} onShow={() => {syncSystemBars(isDark); input.current?.focus();}}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1, justifyContent: 'center', paddingHorizontal: g.inset * s}}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="이름 변경 취소" onPress={onClose}/>
      <View testID="history-rename" accessibilityViewIsModal style={{width: '100%', maxWidth: 440, alignSelf: 'center', padding: g.rowInset * s, borderRadius: g.radius * s, backgroundColor: p.sheet, boxShadow: '0px 8px 36px rgba(0,0,0,0.2)'}}>
        <Text accessibilityRole="header" style={{color: p.text, fontSize: g.rowFont * s, lineHeight: g.rowLine * s, marginBottom: 20 * s}}>이름 변경</Text>
        <TextInput ref={input} testID="history-rename-input" accessibilityLabel="채팅 이름" autoFocus selectTextOnFocus value={title} maxLength={120} onChangeText={setTitle} editable={!saving} returnKeyType="done" onSubmitEditing={() => {void save();}} underlineColorAndroid="transparent"
          style={{color: p.text, backgroundColor: p.background, borderRadius: g.controlRadius * s, paddingHorizontal: 20 * s, paddingVertical: 18 * s, fontSize: g.rowFont * s, minHeight: g.rowHeight * s}}/>
        {!!error && <Text accessibilityRole="alert" style={{color: c.error, marginTop: 12 * s}}>{error}</Text>}
        <View style={{flexDirection: 'row', gap: 12 * s, marginTop: 20 * s}}>
          {[{label: '취소', action: onClose, disabled: saving}, {label: '변경', action: () => {void save();}, disabled: saving || !title.trim()}].map(item => <SettingsPressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{disabled: item.disabled}} disabled={item.disabled} onPress={item.action} radius={g.controlRadius * s} style={{flex: 1}} contentStyle={{minHeight: g.rowHeight * s, alignItems: 'center', justifyContent: 'center', opacity: item.disabled ? 0.4 : 1}}>
            <Text style={{color: p.text, fontSize: g.rowFont * s}}>{item.label}</Text>
          </SettingsPressable>)}
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
