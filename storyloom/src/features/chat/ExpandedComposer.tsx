import {useCallback, useEffect, useRef, useState} from 'react';
import {Animated, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {syncSystemBars, useAppearance} from '../appearance/AppAppearance';
import {ChatIcon} from './ChatIcon';
import {composerScale, headerScale, referenceComposer as r, referenceHeader, typographyScale} from './chatAppearance';
import {panelSpring} from './usePanelMotion';
import {DragClickBoundary} from '../settings/DragClickBoundary';
import {useComposerPull} from './useComposerPull';
import {settingsReference} from '../settings/settingsGeometry';
import {ComposerInput} from './ComposerInput';
import type {ComposerInputHandle} from './ComposerInput.types';
import {useDrawerModalLock} from './DrawerGestureBoundary';

export interface ComposerFrame {x: number; y: number; width: number; height: number; radius: number}
type SheetFrame = Pick<ComposerFrame, 'x' | 'y' | 'width' | 'height'>;

interface Props {
  origin: ComposerFrame;
  measureOrigin: (done: (frame: ComposerFrame) => void) => void;
  sourceInputHeight: number;
  sourceExpandable: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onClose: () => void;
  ready: boolean;
  sending: boolean;
  generating: boolean;
  reduceMotion: boolean;
}

/** One surface grows from the composer bounds and returns to its current bounds. */
export function ExpandedComposer(p: Props) {
  useDrawerModalLock();
  const {colors: c, settings, isDark} = useAppearance();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = composerScale(window.width);
  const textScale = typographyScale(window.width);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef({x: new Animated.Value(0), y: new Animated.Value(0)}).current;
  const input = useRef<ComposerInputHandle>(null);
  const [contentHeight, setContentHeight] = useState(p.sourceInputHeight);
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const [frame, setFrame] = useState(p.origin);
  const [viewport, setViewport] = useState({width: window.width, height: window.height});
  const [shown, setShown] = useState(false);
  const [closingSheet, setClosingSheet] = useState<SheetFrame | null>(null);
  const sheetSnapshot = useRef<SheetFrame>(p.origin);
  const closing = closingSheet !== null;
  const closingRef = useRef(false);
  const mounted = useRef(true);
  const stopWaiting = useRef<(() => void) | null>(null);
  const entered = useRef(false);
  const opening = useRef(true);
  const callbacks = useRef(p);
  callbacks.current = p;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopWaiting.current?.();
      progress.stopAnimation();
    };
  }, [progress]);

  useEffect(() => {
    if (!shown || entered.current) return;
    entered.current = true;
    const finish = () => {if (!closingRef.current && mounted.current) {opening.current = false; input.current?.focus();}};
    if (p.reduceMotion) {progress.setValue(1); finish();}
    else Animated.spring(progress, {...panelSpring, toValue: 1, useNativeDriver: false}).start(({finished}) => {if (finished) finish();});
  }, [p.reduceMotion, progress, shown]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    progress.stopAnimation();
    drag.x.stopAnimation();
    drag.y.stopAnimation();
    // Keyboard dismissal must not move/resize the sheet before the return animation starts.
    setClosingSheet(sheetSnapshot.current);
    const collapse = () => {
      stopWaiting.current?.();
      stopWaiting.current = null;
      // Keyboard dismissal changes the original composer's position and safe-area padding.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!mounted.current) return;
        callbacks.current.measureOrigin(next => {
          if (!mounted.current) return;
          setFrame(next);
          requestAnimationFrame(() => {
            if (!mounted.current) return;
            if (callbacks.current.reduceMotion) {progress.setValue(0); drag.x.setValue(0); drag.y.setValue(0); callbacks.current.onClose();}
            else Animated.parallel([progress, drag.x, drag.y].map(value => Animated.spring(value, {...panelSpring, toValue: 0, useNativeDriver: false}))).start(({finished}) => {if (finished) callbacks.current.onClose();});
          });
        });
      }));
    };
    if (Platform.OS !== 'web' && Keyboard.isVisible()) {
      let finished = false;
      const finish = () => {if (!finished) {finished = true; collapse();}};
      const listener = Keyboard.addListener('keyboardDidHide', finish);
      const timer = setTimeout(finish, 350);
      stopWaiting.current = () => {listener.remove(); clearTimeout(timer);};
      Keyboard.dismiss();
    } else collapse();
  }, [drag, progress]);

  const sheetInset = settingsReference.sheetInset * s;
  const sheetBottom = Math.max(insets.bottom, sheetInset);
  const sheetWidth = Math.min(settingsReference.contentMaxWidth, viewport.width - insets.left - insets.right - 2 * sheetInset);
  // Keep the normal height when the keyboard fits below it; only clamp when space runs out.
  const sheetHeight = Math.max(0, Math.min(window.height * 0.9, viewport.height - insets.top - sheetInset - sheetBottom));
  const sheet = closingSheet ?? {x: insets.left + (viewport.width - insets.left - insets.right - sheetWidth) / 2, y: viewport.height - sheetBottom - sheetHeight, width: sheetWidth, height: sheetHeight};
  sheetSnapshot.current = sheet;
  const pull = useComposerPull(drag, {travel: sheet.height, opening, closing: closingRef, reduceMotion: p.reduceMotion, close});
  const tween = (from: number, to: number) => progress.interpolate({inputRange: [0, 1], outputRange: [from, to]});
  const inputTop = sheetInset + referenceHeader.barHeight * headerScale(window.width) + 16 * s;
  const filled = p.value.length > 0;
  const line = r.lineHeight * textScale * window.fontScale;
  const measured = filled ? Math.max(line, contentHeight) : line;
  const inputHeight = Math.min(measured, Math.max(line, sheet.height - inputTop - 26 * s));
  const overflowing = measured > inputHeight + 1;
  const canSend = p.ready && !p.sending && (!!p.value.trim() || p.generating);
  const ghostOpacity = progress.interpolate({inputRange: [0, 0.25, 1], outputRange: [1, 0, 0], extrapolate: 'clamp'});
  const controlsOpacity = progress.interpolate({inputRange: [0, 0.45, 1], outputRange: [0, 0, 1], extrapolate: 'clamp'});

  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onShow={() => {syncSystemBars(isDark); setShown(true);}} onRequestClose={close}>
    <DragClickBoundary cancelClick={pull.cancelClick}>
    <KeyboardAvoidingView style={{flex: 1}} behavior="padding">
      <View testID="expanded-composer-root" style={{flex: 1}} onLayout={event => {
        const {width, height} = event.nativeEvent.layout;
        setViewport(old => old.width === width && old.height === height ? old : {width, height});
      }}>
        <Pressable accessibilityRole="button" accessibilityLabel="입력창 바깥 눌러 접기" onPress={close} style={{position: 'absolute', inset: 0}}/>
        <Animated.View testID="expanded-composer-surface" accessibilityViewIsModal onAccessibilityEscape={close} {...pull.panHandlers} style={{
          position: 'absolute', left: tween(frame.x, sheet.x), top: tween(frame.y, sheet.y), width: tween(frame.width, sheet.width), height: tween(frame.height, sheet.height),
          borderRadius: tween(frame.radius, settingsReference.radius * s), borderWidth: tween(s, 0), borderColor: c.border, backgroundColor: settings.sheet, overflow: 'hidden',
          boxShadow: isDark ? '0px 4px 28px rgba(0, 0, 0, 0.4)' : '0px 4px 28px rgba(0, 0, 0, 0.12)',
          transform: [{translateX: drag.x}, {translateY: drag.y}],
        }}>
          <Animated.View testID="expanded-composer-handle" pointerEvents="none" accessible={false} style={{position: 'absolute', alignSelf: 'center', top: settingsReference.sheetHandle.top * s, width: settingsReference.sheetHandle.width * s, height: settingsReference.sheetHandle.height * s, borderRadius: settingsReference.sheetHandle.radius * s, backgroundColor: settings.divider, opacity: controlsOpacity}}/>
          {/* Only the text block owns editing gestures; the unused sheet area stays draggable. */}
          <Animated.View onStartShouldSetResponderCapture={pull.blockInput} style={{position: 'absolute', left: tween((filled ? 26 : 116) * s, 26 * s), right: 26 * s, top: tween(filled ? 25 * s : (r.compactHeight * s - line) / 2, inputTop), height: tween(p.sourceInputHeight, inputHeight), overflow: 'hidden'}}>
            <ComposerInput focusRef={input} testID="expanded-composer-input" label="확장 메시지 입력" value={p.value} onChange={p.onChange} onFocus={() => {}} onHeight={reportHeight} fontSize={r.fontSize * textScale} lineHeight={r.lineHeight * textScale} height={inputHeight} scroll={overflowing} ready={p.ready && !closing}/>
          </Animated.View>
          <Animated.View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position: 'absolute', left: (filled ? 12 : 20) * s, right: (filled ? 13 : 20) * s, bottom: (filled ? 14 : (r.compactHeight - r.button) / 2) * s, flexDirection: 'row', alignItems: 'center', opacity: ghostOpacity}}>
            <GhostAction icon="plus" scale={s}/><View style={{flex: 1}}/>{p.sourceExpandable && <GhostAction icon="expand" scale={s}/>}{(!!p.value.trim() || p.generating) && <><View style={{width: p.sourceExpandable ? 13 * s : 0}}/><GhostAction icon="send" scale={s} bright/></>}
          </Animated.View>
          <Animated.View pointerEvents={closing ? 'none' : 'auto'} style={{position: 'absolute', top: sheetInset, left: 0, right: 0, opacity: controlsOpacity}}>
            <ScreenHeader width={viewport.width} testID="expanded-composer-header">
              <HeaderButton width={viewport.width} testID="expanded-composer-close" icon="close" label="입력창 접기" onPress={close}/>
              <View style={{flex: 1}}/>
              <HeaderButton width={viewport.width} testID="expanded-composer-send" icon={p.generating ? 'stop' : 'send'} label={p.generating ? '응답 중단' : '메시지 보내기'} bright disabled={!canSend} onPress={() => {if (p.generating) p.onCancel(); else {p.onSend(); close();}}}/>
            </ScreenHeader>
          </Animated.View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
    </DragClickBoundary>
  </Modal>;
}

function GhostAction({icon, scale: s, bright = false}: {icon: 'plus' | 'expand' | 'send'; scale: number; bright?: boolean}) {
  const {colors: c} = useAppearance();
  return <View style={{width: r.button * s, height: r.button * s, borderRadius: r.button * s / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bright ? c.send : c.button}}><ChatIcon name={icon} size={(icon === 'plus' ? 27 : 25) * s} color={bright ? c.sendIcon : c.buttonIcon}/></View>;
}
