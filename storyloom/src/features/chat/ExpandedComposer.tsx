import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Animated, BackHandler, Keyboard, Platform, Pressable, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {useAppearance} from '../appearance/AppAppearance';
import {ChatIcon} from './ChatIcon';
import {composerScale, headerScale, referenceComposer as r, referenceHeader, typographyScale} from './chatAppearance';
import {panelSpringForDistance} from './panelAnimation';
import {DragClickBoundary} from '../settings/DragClickBoundary';
import {useComposerPull} from './useComposerPull';
import {settingsReference} from '../settings/settingsGeometry';
import {ComposerInput} from './ComposerInput';
import type {ComposerInputHandle, ComposerSelection} from './ComposerInput.types';
import {useDrawerModalLock} from './DrawerGestureBoundary';
import {composerEditorHeight, expandedComposerFrame, type ComposerFrame} from './composerGeometry';
import {ChatOverlay} from './ChatOverlay';

export type {ComposerFrame} from './composerGeometry';
const frameKeys = ['x', 'y', 'width', 'height', 'radius'] as const;

interface Props {
  origin: ComposerFrame;
  selection: ComposerSelection;
  measureOrigin: (done: (frame: ComposerFrame) => void) => void;
  sourceInputHeight: number;
  sourceExpandable: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onClose: (selection: ComposerSelection, keepFocus: boolean) => void;
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
  const bounds = useRef({
    x: new Animated.Value(p.origin.x), y: new Animated.Value(p.origin.y),
    width: new Animated.Value(p.origin.width), height: new Animated.Value(p.origin.height),
    radius: new Animated.Value(p.origin.radius),
  }).current;
  const drag = useRef({x: new Animated.Value(0), y: new Animated.Value(0)}).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const input = useRef<ComposerInputHandle>(null);
  const [contentHeight, setContentHeight] = useState(p.sourceInputHeight);
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const [visibleHeight, setVisibleHeight] = useState(window.height);
  const [keyboardTop, setKeyboardTop] = useState(() => Keyboard.metrics?.()?.screenY ?? Infinity);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const mounted = useRef(true);
  const entered = useRef(false);
  const gestureHeld = useRef(false);
  const handingOff = useRef(false);
  const generation = useRef(0);
  const callbacks = useRef(p);
  callbacks.current = p;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      animation.current?.stop();
      progress.stopAnimation();
    };
  }, [progress]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => {if (!closingRef.current) setKeyboardTop(event.endCoordinates.screenY);});
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {if (!closingRef.current) setKeyboardTop(Infinity);});
    return () => {show.remove(); hide.remove();};
  }, []);

  const animateTo = useCallback((frame: ComposerFrame, expanded: boolean, finish: () => void) => {
    const attempt = ++generation.current;
    animation.current?.stop();
    const targets: [Animated.Value, number][] = [
      ...frameKeys.map(key => [bounds[key], frame[key]] as [Animated.Value, number]),
      [progress, expanded ? 1 : 0], [drag.x, 0], [drag.y, 0],
    ];
    if (callbacks.current.reduceMotion) {
      for (const [value, target] of targets) value.setValue(target);
      finish();
    } else {
      animation.current = Animated.parallel(targets.map(([value, toValue]) => Animated.spring(value, {
        ...panelSpringForDistance(value === progress ? Math.max(window.width, window.height) : 1),
        toValue, useNativeDriver: false,
      })));
      animation.current.start(({finished}) => {if (finished && mounted.current && attempt === generation.current) finish();});
    }
  }, [bounds, drag, progress, window.width, window.height]);

  const sheet = expandedComposerFrame(window, insets);
  useLayoutEffect(() => {
    if (!shown || closingRef.current || gestureHeld.current) return;
    animateTo(sheet, true, () => {});
    if (!entered.current) {
      entered.current = true;
      input.current?.focus(callbacks.current.selection);
    }
  }, [animateTo, shown, sheet.x, sheet.y, sheet.width, sheet.height, sheet.radius]);

  const close = useCallback(() => {
    if (closingRef.current || handingOff.current) return;
    const attempt = ++generation.current;
    gestureHeld.current = false;
    closingRef.current = true;
    setClosing(true);
    animation.current?.stop();
    drag.x.stopAnimation();
    drag.y.stopAnimation();
    // Keep editing throughout the morph. The hidden composer tracks the live
    // keyboard inset, so its measured bounds are already the right destination.
    callbacks.current.measureOrigin(frame => {
      if (mounted.current && attempt === generation.current) animateTo(frame, false, () => {
        handingOff.current = true;
        callbacks.current.onClose(input.current?.getSelection() ?? callbacks.current.selection, Platform.OS === 'web' || Keyboard.isVisible());
      });
    });
  }, [animateTo, drag]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {close(); return true;});
      return () => listener.remove();
    }
    if (Platform.OS === 'web') {
      const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); close();}};
      document.addEventListener('keydown', escape);
      return () => document.removeEventListener('keydown', escape);
    }
    return undefined;
  }, [close]);

  const sheetInset = settingsReference.sheetInset * s;
  const pull = useComposerPull(drag, {
    travel: sheet.height,
    ready: () => entered.current && !handingOff.current,
    grab: () => {
      generation.current++;
      animation.current?.stop();
      gestureHeld.current = true;
      closingRef.current = false;
      setClosing(false);
    },
    restore: () => {
      gestureHeld.current = false;
      animateTo(sheet, true, () => {});
    },
    close,
  });
  const tween = (from: number, to: number) => progress.interpolate({inputRange: [0, 1], outputRange: [from, to]});
  const inputTop = sheetInset + referenceHeader.barHeight * headerScale(window.width) + 16 * s;
  const filled = p.value.length > 0;
  const line = r.lineHeight * textScale * window.fontScale;
  const measured = filled ? Math.max(line, contentHeight) : line;
  const inputHeight = composerEditorHeight(sheet, inputTop, measured, line, 26 * s, Math.min(visibleHeight, keyboardTop));
  const overflowing = measured > inputHeight + 1;
  const canSend = p.ready && !p.sending && (!!p.value.trim() || p.generating);
  const ghostOpacity = progress.interpolate({inputRange: [0, 0.25, 1], outputRange: [1, 0, 0], extrapolate: 'clamp'});
  const controlsOpacity = progress.interpolate({inputRange: [0, 0.45, 1], outputRange: [0, 0, 1], extrapolate: 'clamp'});
  const surfaceColor = progress.interpolate({inputRange: [0, 1], outputRange: [c.composer, settings.sheet]});
  const surfaceShadow = progress.interpolate({inputRange: [0, 1], outputRange: isDark
    ? ['0px 4px 28px rgba(0, 0, 0, 0)', '0px 4px 28px rgba(0, 0, 0, 0.4)']
    : ['0px 6px 26px rgba(0, 0, 0, 0.08)', '0px 4px 28px rgba(0, 0, 0, 0.12)']});

  return <ChatOverlay onRequestClose={close}>
    <DragClickBoundary cancelClick={pull.cancelClick}>
      <View testID="expanded-composer-root" style={{flex: 1}} onLayout={event => {setVisibleHeight(event.nativeEvent.layout.height); setShown(true);}}>
        {/* A fixed canvas lets the native keyboard cover the sheet without moving its corners. */}
        <View style={{width: window.width, height: window.height}}>
        <Pressable accessibilityRole="button" accessibilityLabel="입력창 바깥 눌러 접기" onPress={close} style={{position: 'absolute', inset: 0}}/>
        <Animated.View testID="expanded-composer-surface" accessibilityViewIsModal onAccessibilityEscape={close} {...pull.panHandlers} style={{
          position: 'absolute', left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height,
          borderRadius: bounds.radius, borderWidth: tween(s, 0), borderColor: c.border, backgroundColor: surfaceColor, overflow: 'hidden',
          boxShadow: surfaceShadow,
          transform: [{translateX: drag.x}, {translateY: drag.y}],
        }}>
          <Animated.View testID="expanded-composer-handle" pointerEvents="none" accessible={false} style={{position: 'absolute', alignSelf: 'center', top: settingsReference.sheetHandle.top * s, width: settingsReference.sheetHandle.width * s, height: settingsReference.sheetHandle.height * s, borderRadius: settingsReference.sheetHandle.radius * s, backgroundColor: settings.divider, opacity: controlsOpacity}}/>
          {/* Only the text block owns editing gestures; the unused sheet area stays draggable. */}
          <Animated.View pointerEvents={closing ? 'none' : 'auto'} onStartShouldSetResponderCapture={pull.blockInput} style={{position: 'absolute', left: tween((filled ? 26 : 116) * s, 26 * s), right: 26 * s, top: tween(filled ? 25 * s : (r.compactHeight * s - line) / 2, inputTop), height: tween(p.sourceInputHeight, inputHeight), overflow: 'hidden'}}>
            <ComposerInput focusRef={input} testID="expanded-composer-input" label="확장 메시지 입력" value={p.value} onChange={p.onChange} onFocus={() => {}} onHeight={reportHeight} fontSize={r.fontSize * textScale} lineHeight={r.lineHeight * textScale} height={inputHeight} fillHeight={closing} scroll={overflowing} ready={p.ready}/>
          </Animated.View>
          <Animated.View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position: 'absolute', left: (filled ? 12 : 20) * s, right: (filled ? 13 : 20) * s, bottom: (filled ? 14 : (r.compactHeight - r.button) / 2) * s, flexDirection: 'row', alignItems: 'center', opacity: ghostOpacity}}>
            <GhostAction icon="plus" scale={s}/><View style={{flex: 1}}/>{p.sourceExpandable && <GhostAction icon="expand" scale={s}/>}{(!!p.value.trim() || p.generating) && <><View style={{width: p.sourceExpandable ? 13 * s : 0}}/><GhostAction icon="send" scale={s} bright/></>}
          </Animated.View>
          <Animated.View pointerEvents={closing ? 'none' : 'auto'} style={{position: 'absolute', top: sheetInset, left: 0, right: 0, opacity: controlsOpacity}}>
            <ScreenHeader width={window.width} testID="expanded-composer-header">
              <HeaderButton width={window.width} testID="expanded-composer-close" icon="close" label="입력창 접기" onPress={close}/>
              <View style={{flex: 1}}/>
              <HeaderButton width={window.width} testID="expanded-composer-send" icon={p.generating ? 'stop' : 'send'} label={p.generating ? '응답 중단' : '메시지 보내기'} bright disabled={!canSend} onPress={() => {if (p.generating) p.onCancel(); else {p.onSend(); close();}}}/>
            </ScreenHeader>
          </Animated.View>
        </Animated.View>
        </View>
      </View>
    </DragClickBoundary>
  </ChatOverlay>;
}

function GhostAction({icon, scale: s, bright = false}: {icon: 'plus' | 'expand' | 'send'; scale: number; bright?: boolean}) {
  const {colors: c} = useAppearance();
  return <View style={{width: r.button * s, height: r.button * s, borderRadius: r.button * s / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bright ? c.send : c.button}}><ChatIcon name={icon} size={(icon === 'plus' ? 27 : 25) * s} color={bright ? c.sendIcon : c.buttonIcon}/></View>;
}
