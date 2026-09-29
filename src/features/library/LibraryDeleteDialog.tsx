import {useCallback, useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PressSurface} from '../../layout/PressSurface';
import {headerScale} from '../../layout/metrics';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';
import {useDrawerModalLock} from '../chat/DrawerGestureBoundary';

export function LibraryDeleteDialog({title, detail, onClose, onDelete, scope = 'persona'}: {
  scope?: string; title: string; detail: string; onClose: () => void; onDelete: () => Promise<void>;
}) {
  const {settings: p, colors: c, isDark} = useAppearance();
  const {width, height} = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const s = headerScale(width);
  const dialogWidth = Math.min(340, (width - safe.left - safe.right) * 0.68);
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useRef(false);
  const closing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const finished = useRef(false);
  const mounted = useRef(false);
  useDrawerModalLock();
  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!mounted.current || closing.current) return;
      reduced.current = value;
      Animated.timing(progress, {toValue: 1, duration: value ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true}).start();
    });
    return () => {mounted.current = false; progress.stopAnimation();};
  }, [progress]);
  // Confirmation stays open on Escape, Android back, outside taps and swipes.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); event.stopImmediatePropagation();}};
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, []);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, {toValue: 0, duration: reduced.current ? 0 : 120, easing: Easing.in(Easing.quad), useNativeDriver: true}).start(({finished: complete}) => {
      if (complete && mounted.current) onClose();
    });
  }, [onClose, progress]);
  const confirm = async () => {
    if (pending.current || finished.current || closing.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await onDelete(); finished.current = true;
      if (mounted.current) close();
    } catch {
      if (mounted.current) setError('삭제하지 못했어요. 다시 시도해 주세요.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}} onShow={() => syncSystemBars(isDark)}>
    <View testID={`${scope}-delete-overlay`} accessibilityViewIsModal onAccessibilityEscape={() => {}} style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: safe.top, paddingBottom: safe.bottom}}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: 'rgba(0,0,0,0.6)', opacity: progress}]}/>
      <Animated.View testID={`${scope}-delete-confirm`} style={{width: dialogWidth, maxHeight: (height - safe.top - safe.bottom) * 0.8,
        borderRadius: 28 * s, backgroundColor: p.sheet, overflow: 'hidden', opacity: progress,
        transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
        <ScrollView style={{flexShrink: 1}} contentContainerStyle={{paddingHorizontal: 32 * s, paddingVertical: 48 * s}} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={{color: p.text, fontSize: 26 * s, lineHeight: 36 * s, fontWeight: '700', textAlign: 'center'}}>{title}</Text>
          <Text style={{color: p.text, fontSize: 25 * s, lineHeight: 36 * s, marginTop: 14 * s, textAlign: 'center'}}>{detail}</Text>
          {!!error && <Text accessibilityRole="alert" style={{color: c.error, fontSize: 22 * s, marginTop: 18 * s}}>{error}</Text>}
        </ScrollView>
        <View style={{flexShrink: 0}}>
          {(['delete', 'cancel'] as const).map(action => <PressSurface key={action} accessibilityRole="button" accessibilityLabel={action === 'cancel' ? '삭제 취소' : '삭제 확인'}
            disabled={busy} onPress={action === 'cancel' ? () => {if (!pending.current) close();} : () => {void confirm();}} radius={0} highlightColor={p.selected}
            style={{height: 88 * s, borderTopWidth: .5, borderTopColor: p.divider, opacity: busy ? .4 : 1}}
            contentStyle={{backgroundColor: p.sheet, alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{color: action === 'cancel' ? p.text : c.error, fontSize: 25 * s, fontWeight: action === 'cancel' ? '400' : '600'}}>{action === 'cancel' ? '취소' : '삭제'}</Text>
          </PressSurface>)}
        </View>
      </Animated.View>
    </View>
  </Modal>;
}
