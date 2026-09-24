import {useCallback, useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PressSurface} from '../../layout/PressSurface';
import {headerScale, referenceTypography} from '../../layout/metrics';
import {panelReference as g} from '../../layout/panelGeometry';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';
import {useDrawerModalLock} from '../chat/DrawerGestureBoundary';

export function LibraryDeleteDialog({title, detail, onClose, onDelete, scope = 'persona'}: {
  scope?: string; title: string; detail: string; onClose: () => void; onDelete: () => Promise<void>;
}) {
  const {settings: p, colors: c, isDark} = useAppearance();
  const {width, height} = useWindowDimensions();
  const safe = useSafeAreaInsets();
  const s = headerScale(width);
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
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)', opacity: progress}]}/>
      <Animated.View testID={`${scope}-delete-confirm`} style={{width: Math.min(340, (width - safe.left - safe.right) * 0.82), maxHeight: (height - safe.top - safe.bottom) * 0.8,
        padding: g.rowInset * s, paddingBottom: g.groupPadding * s, borderRadius: g.radius * s, backgroundColor: p.sheet,
        boxShadow: isDark ? '0px 6px 28px rgba(0,0,0,0.4)' : '0px 6px 28px rgba(0,0,0,0.15)', opacity: progress,
        transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]})}]}}>
        <ScrollView style={{flexShrink: 1}} showsVerticalScrollIndicator={false}>
          <Text accessibilityRole="header" style={{color: p.text, fontSize: 32 * s, lineHeight: 44 * s, fontWeight: referenceTypography.titleWeight}}>{title}</Text>
          <Text style={{color: p.secondary, fontSize: 24 * s, lineHeight: 36 * s, marginTop: 16 * s}}>{detail}</Text>
          {!!error && <Text accessibilityRole="alert" style={{color: c.error, fontSize: 22 * s, marginTop: 18 * s}}>{error}</Text>}
        </ScrollView>
        <View style={{height: 78 * s, flexShrink: 0, flexDirection: 'row', gap: 14 * s, marginTop: 24 * s}}>
          {(['delete', 'cancel'] as const).map(action => <PressSurface key={action} accessibilityRole="button" accessibilityLabel={action === 'cancel' ? '삭제 취소' : '삭제 확인'}
            disabled={busy} onPress={action === 'cancel' ? () => {if (!pending.current) close();} : () => {void confirm();}} radius={g.controlRadius * s} highlightColor={p.selected} style={{flex: 1}}
            contentStyle={{minHeight: 78 * s, backgroundColor: p.selected, alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{color: action === 'cancel' ? p.text : c.error, fontSize: g.rowFont * s}}>{action === 'cancel' ? '취소' : '삭제'}</Text>
          </PressSurface>)}
        </View>
      </Animated.View>
    </View>
  </Modal>;
}
