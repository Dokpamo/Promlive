import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, BackHandler, PixelRatio, Platform, Pressable, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {KeyboardDock, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {PressSurface} from '../../layout/PressSurface';
import {EdgeTint} from '../../layout/EdgeTint';
import {ChatIcon, type ChatIconName} from './ChatIcon';
import {ComposerInput} from './ComposerInput';
import type {ComposerInputHandle} from './ComposerInput.types';
import {DrawerGestureBoundary, useDrawerModalLock} from './DrawerGestureBoundary';
import {composerScale, referenceComposer as r, typographyScale} from './chatAppearance';
import {headerScale, referenceHeader} from '../../layout/metrics';
import {useAppearance} from '../appearance/AppAppearance';
import {panelSpringForDistance} from '../../layout/panelAnimation';
import {composerEditorHeight, expandedComposerFrame} from './composerGeometry';
import {DragClickBoundary} from '../../layout/DragClickBoundary';
import {panelReference} from '../../layout/panelGeometry';
import {SheetScrollView} from '../../layout/SheetScrollView';
import {SheetGestureRoot} from '../../layout/SheetGestureRoot';
import type {SheetScrollState} from '../../layout/sheetMotion';
import {useComposerPull} from './useComposerPull';
import {useComposerLayoutFrame} from './useComposerLayoutFrame';
import type {ComposerAction} from './ChatSession';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onHint: (message: string) => void;
  onHeight?: (height: number) => void;
  onExpandedChange?: (expanded: boolean) => void;
  width: number;
  bottom: number;
  ready: boolean;
  action: ComposerAction;
}

/** One permanently mounted editor and surface, from the bottom dock to the sheet. */
export function ChatComposer(p: Props) {
  const {colors: c, settings, isDark} = useAppearance();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardFrame();
  const s = composerScale(p.width);
  const textScale = typographyScale(p.width);
  const line = r.lineHeight * textScale * window.fontScale;
  const [contentHeight, setContentHeight] = useState(line);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const modal = visible || preparing;
  const input = useRef<ComposerInputHandle>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const callbacks = useRef(p);
  callbacks.current = p;
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const filled = p.value.length > 0;
  const measured = filled ? Math.max(line, contentHeight) : line;
  const inputHeight = filled ? Math.min(measured, r.maxLines * line) : line;
  const height = filled ? inputHeight + (r.firstLineHeight - r.lineHeight) * s : r.compactHeight * s;
  const expandable = filled && Math.round(measured / line) >= 2;
  const cancelling = p.action.kind === 'cancel';
  const hasSend = !!p.value.trim() || cancelling;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef({x: new Animated.Value(0), y: new Animated.Value(0)}).current;
  const motion = useRef({
    height: new Animated.Value(height), input: new Animated.Value(inputHeight),
    filled: new Animated.Value(filled ? 1 : 0), expand: new Animated.Value(expandable ? 1 : 0), send: new Animated.Value(hasSend ? 1 : 0),
  }).current;
  const frame = useComposerLayoutFrame(progress, motion, {height, input: inputHeight, filled: filled ? 1 : 0});
  useDrawerModalLock(modal);
  useLayoutEffect(() => {callbacks.current.onExpandedChange?.(modal);}, [modal]);
  useEffect(() => {
    mounted.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted.current) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted.current = false; generation.current++; animation.current?.stop(); change.remove();};
  }, []);
  useLayoutEffect(() => {
    const targets: [Animated.Value, number][] = [[motion.height, height], [motion.input, inputHeight], [motion.filled, filled ? 1 : 0], [motion.expand, expandable ? 1 : 0], [motion.send, hasSend ? 1 : 0]];
    if (modal || reduceMotion !== false || !p.ready) {
      for (const [value, to] of targets) {value.stopAnimation(); value.setValue(to);}
      return;
    }
    const resizing = Animated.parallel(targets.map(([value, toValue]) => Animated.spring(value, {...panelSpringForDistance(), toValue, useNativeDriver: false})));
    resizing.start();
    return () => resizing.stop();
  }, [expandable, filled, hasSend, height, inputHeight, modal, motion, p.ready, reduceMotion]);
  useEffect(() => {
    const listener = motion.height.addListener(({value}) => callbacks.current.onHeight?.(value + p.bottom + r.bottom * s));
    callbacks.current.onHeight?.(height + p.bottom + r.bottom * s);
    return () => motion.height.removeListener(listener);
  }, [height, motion.height, p.bottom, s]);

  const settle = useCallback((open: boolean) => {
    const attempt = ++generation.current;
    animation.current?.stop();
    setPreparing(false);
    setTransitioning(true);
    setExpanded(open);
    if (open) setVisible(true);
    const finish = () => {
      if (!mounted.current || generation.current !== attempt) return;
      setTransitioning(false);
      if (!open) setVisible(false);
    };
    if (reduceMotion) {
      progress.setValue(open ? 1 : 0); drag.x.setValue(0); drag.y.setValue(0); finish();
    } else {
      animation.current = Animated.parallel([
        Animated.spring(progress, {...panelSpringForDistance(window.height), toValue: open ? 1 : 0, useNativeDriver: false}),
        Animated.spring(drag.x, {...panelSpringForDistance(), toValue: 0, useNativeDriver: false}),
        Animated.spring(drag.y, {...panelSpringForDistance(), toValue: 0, useNativeDriver: false}),
      ]);
      animation.current.start(({finished}) => {if (finished) finish();});
    }
  }, [drag, progress, reduceMotion, window.height]);
  const open = useCallback(() => {
    const editor = input.current;
    if (!editor) return;
    const attempt = ++generation.current;
    animation.current?.stop();
    setPreparing(true);
    setTransitioning(true);
    editor.focusForExpansion(() => {
      if (mounted.current && generation.current === attempt) settle(true);
    });
  }, [settle]);
  const close = useCallback(() => {
    // A web button takes focus on click; native presses keep the same editor focused.
    if (Platform.OS === 'web') input.current?.focus();
    settle(false);
  }, [settle]);
  useEffect(() => {
    if (!modal) return;
    if (Platform.OS === 'android') {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {close(); return true;});
      return () => listener.remove();
    }
    if (Platform.OS === 'web') {
      const keydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {event.preventDefault(); close();}
        if (event.key !== 'Tab') return;
        const surface = document.querySelector('[data-testid="expanded-composer-surface"]');
        const controls = Array.from(surface?.querySelectorAll<HTMLElement>('textarea, [role="button"][tabindex="0"]') ?? [])
          .filter(node => !node.closest('[aria-hidden="true"]') && node.getAttribute('aria-disabled') !== 'true' && node.getBoundingClientRect().height > 0);
        if (!controls.length) return;
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (index < 0 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
          event.preventDefault();
          controls[event.shiftKey ? controls.length - 1 : 0]?.focus({preventScroll: true});
        }
      };
      document.addEventListener('keydown', keydown);
      return () => document.removeEventListener('keydown', keydown);
    }
    return undefined;
  }, [close, modal]);

  const sheet = expandedComposerFrame(window, insets);
  const scroll = useRef<SheetScrollState>({offset: 0, canScroll: false, maxOffset: 0});
  const canScrollInput = useCallback(() => {
    const selection = input.current?.getSelection();
    return !selection || selection.start === selection.end;
  }, []);
  const pull = useComposerPull(drag, {
    travel: sheet.height, ready: () => visible,
    grab: () => {generation.current++; animation.current?.stop(); setTransitioning(false); setExpanded(true);},
    restore: () => settle(true), close, scroll,
    canScrollPull: canScrollInput,
  });
  const blend = (from: number, to: number) => from + (to - from) * frame.progress;
  const shape = (empty: number, full: number) => (empty + (full - empty) * frame.filled) * s;
  const collapsedWidth = Math.min(800, window.width - insets.left - insets.right) - 2 * r.inset * s;
  const collapsedLeft = insets.left + (window.width - insets.left - insets.right - collapsedWidth) / 2;
  // Morph the surface around a stable text column instead of rewrapping every frame.
  const textWidth = Math.max(1, Math.min(collapsedWidth - 54 * s, sheet.width - 52 * s));
  const compactTextLeft = filled ? (collapsedWidth - textWidth) / 2 - s : 116 * s;
  const compactTextWidth = filled ? textWidth : collapsedWidth - 144 * s;
  const surfaceLeft = PixelRatio.roundToNearestPixel(blend(collapsedLeft, sheet.x));
  const surfaceBorder = PixelRatio.roundToNearestPixel(blend(s, 0));
  // Round the final screen position once; nested rounded offsets can wobble by a pixel.
  const textLeft = PixelRatio.roundToNearestPixel(blend(collapsedLeft + compactTextLeft + s, sheet.x + (sheet.width - textWidth) / 2)) - surfaceLeft - surfaceBorder;
  const sheetInset = panelReference.sheetInset * s;
  const headerSize = headerScale(p.width);
  const inputTop = sheetInset + referenceHeader.barHeight * headerSize + 16 * s;
  const footerHeight = sheetInset + referenceHeader.height * headerSize + 16 * s;
  const editorHeight = composerEditorHeight(sheet, inputTop, measured, line, footerHeight, window.height - keyboard.height);
  const activeHeight = visible ? editorHeight : inputHeight;
  const scrollable = measured + (visible ? inputTop + footerHeight : 0) > activeHeight + 1;
  scroll.current.canScroll = scrollable;
  scroll.current.maxOffset = Math.max(0, measured + (visible ? inputTop + footerHeight : 0) - activeHeight);
  const button = r.button * s;
  const actionBottom = shape((r.compactHeight - r.button) / 2, 14);
  const collapsedOpacity = Math.max(0, 1 - frame.progress / 0.3);
  const expandedOpacity = Math.max(0, (frame.progress - 0.45) / 0.55);
  const {fraction, footerFraction} = useMemo(() => ({
    fraction: progress.interpolate({inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp'}),
    footerFraction: progress.interpolate({inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp'}),
  }), [progress]);
  const backgroundColor = useMemo(() => progress.interpolate({inputRange: [0, 1], outputRange: [c.composer, settings.sheet]}), [c.composer, progress, settings.sheet]);
  const composerGeometry = modal && Math.abs(height - sheet.height) > 1 ? {compactHeight: height, expandedHeight: sheet.height} : undefined;

  return <KeyboardDock fraction={fraction} bottomInset={p.bottom} freezeKeyboard={expanded || preparing} followCaret={modal} anchorEditor={transitioning} composerGeometry={composerGeometry}>
    <DrawerGestureBoundary style={{flex: 1}}>
    <DragClickBoundary cancelClick={pull.cancelClick}>
      <Animated.View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: frame.height + p.bottom + (r.bottom + 40) * s, opacity: fraction}}>
        <EdgeTint edge="bottom" testID="composer-tint" style={{flex: 1}}/>
      </Animated.View>
      {modal && <Pressable accessibilityRole="button" accessibilityLabel="입력창 바깥 눌러 접기" onPress={close} style={{position: 'absolute', inset: 0}}/>}
      <Animated.View nativeID="promlive-composer-surface" testID={visible ? 'expanded-composer-surface' : 'chat-composer'} accessibilityViewIsModal={visible} onAccessibilityEscape={visible ? close : undefined} {...pull.panHandlers} style={{
        position: 'absolute', left: surfaceLeft, width: blend(collapsedWidth, sheet.width),
        bottom: blend(p.bottom + r.bottom * s, window.height - sheet.y - sheet.height), height: blend(frame.height, sheet.height),
        borderRadius: blend(shape(r.compactHeight / 2, 40), sheet.radius), borderWidth: surfaceBorder, borderColor: c.border,
        backgroundColor, overflow: 'hidden',
        boxShadow: isDark ? undefined : '0px 6px 26px rgba(0, 0, 0, 0.08)', transform: [{translateX: drag.x}, {translateY: drag.y}],
      }}>
        {/* Keep native gesture hit testing inside the composer, away from chat navigation. */}
        <SheetGestureRoot>
        <Animated.View testID="composer-scroll-viewport" onStartShouldSetResponderCapture={pull.blockScroll} style={{position: 'absolute', left: textLeft, width: blend(compactTextWidth, textWidth), top: blend(shape((r.compactHeight - line / s) / 2, 25), 0), height: blend(frame.input, editorHeight), overflow: 'hidden'}}>
          <SheetScrollView testID="composer-scroll" nativeID="promlive-composer-scroll" sheetScroll={scroll} sheetDrag={pull.scrollDrag} canStartInputScroll={canScrollInput} scrollEnabled={scrollable} keyboardShouldPersistTaps="always" keyboardDismissMode="none" contentInsetAdjustmentBehavior="never" automaticallyAdjustKeyboardInsets={false} showsVerticalScrollIndicator={false} scrollEventThrottle={16} style={{flex: 1}} onScroll={event => {
            const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
            const state = scroll.current;
            if (Math.abs(state.offset - contentOffset.y) > 1) state.hasScrolled = true;
            state.offset = contentOffset.y;
            state.maxOffset = Math.max(0, contentSize.height - layoutMeasurement.height);
          }}>
            <View pointerEvents="none" style={{height: frame.progress * inputTop}}/>
            <View onStartShouldSetResponderCapture={pull.blockInput} style={{height: measured}}>
              <ComposerInput focusRef={input} testID={visible ? 'expanded-composer-input' : 'chat-input'} label={visible ? '확장 메시지 입력' : '메시지 입력'} value={p.value} onChange={p.onChange} onFocus={() => {}} onHeight={reportHeight} fontSize={r.fontSize * textScale} lineHeight={r.lineHeight * textScale} height={measured} fillHeight scroll={false} ready={p.ready}/>
            </View>
            <View pointerEvents="none" style={{height: frame.progress * footerHeight}}/>
          </SheetScrollView>
        </Animated.View>
        <Animated.View pointerEvents={modal ? 'none' : 'box-none'} aria-hidden={modal} accessibilityElementsHidden={modal} importantForAccessibility={modal ? 'no-hide-descendants' : 'auto'} style={{position: 'absolute', inset: 0, opacity: collapsedOpacity}}>
          <Animated.View style={{position: 'absolute', left: shape(20, 12), bottom: actionBottom}}><Circle label="첨부" icon="plus" size={button} iconSize={27 * s} onPress={() => p.onHint('첨부 기능은 아직 연결하지 않았어요.')}/></Animated.View>
          <Animated.View style={{position: 'absolute', right: shape(20, 13), bottom: actionBottom, flexDirection: 'row'}}>
            <Animated.View pointerEvents={expandable ? 'auto' : 'none'} aria-hidden={!expandable} accessibilityElementsHidden={!expandable} importantForAccessibility={expandable ? 'auto' : 'no-hide-descendants'} style={{width: Animated.multiply(motion.expand, button), opacity: motion.expand, overflow: 'hidden'}}>
              <Circle label="입력창 크게 열기" icon="expand" size={button} iconSize={25 * s} onPress={open}/>
            </Animated.View>
            <Animated.View pointerEvents={hasSend ? 'auto' : 'none'} aria-hidden={!hasSend} accessibilityElementsHidden={!hasSend} importantForAccessibility={hasSend ? 'auto' : 'no-hide-descendants'} style={{width: Animated.multiply(motion.send, button), marginLeft: Animated.multiply(Animated.multiply(motion.expand, motion.send), 13 * s), opacity: motion.send, overflow: 'hidden'}}>
              <Circle label={p.action.label} icon={cancelling ? 'stop' : 'send'} size={button} iconSize={25 * s} bright disabled={!p.action.enabled} onPress={cancelling ? p.onCancel : p.onSend}/>
            </Animated.View>
          </Animated.View>
        </Animated.View>
        <Animated.View testID="expanded-composer-handle" pointerEvents="none" accessible={false} style={{position: 'absolute', alignSelf: 'center', top: panelReference.sheetHandle.top * s, width: panelReference.sheetHandle.width * s, height: panelReference.sheetHandle.height * s, borderRadius: panelReference.sheetHandle.radius * s, backgroundColor: settings.divider, opacity: expandedOpacity}}/>
        <Animated.View pointerEvents={expanded ? 'box-none' : 'none'} aria-hidden={!visible} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={{position: 'absolute', top: sheetInset, left: 0, right: 0, opacity: expandedOpacity}}>
          <ScreenHeader width={p.width} testID="expanded-composer-header" edgeTint={false}>
            <View style={{flex: 1}} pointerEvents="none"/>
            <HeaderButton width={p.width} testID="expanded-composer-close" icon="close" label="입력창 접기" onPress={close}/>
          </ScreenHeader>
        </Animated.View>
        <Animated.View pointerEvents={expanded ? 'box-none' : 'none'} aria-hidden={!visible} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={{position: 'absolute', inset: 0, opacity: expandedOpacity}}>
          {/* Follow native IME frames independently of the fixed sheet. */}
          <KeyboardDock fraction={footerFraction} bottomInset={window.height - sheet.y - sheet.height} freezeKeyboard={false} followCaret={false} composerGeometry={composerGeometry && {...composerGeometry, footer: true}}>
            <View testID="expanded-composer-footer" pointerEvents="box-none" style={{position: 'absolute', right: referenceHeader.inset * headerSize, bottom: sheetInset}}>
              <HeaderButton width={p.width} testID="expanded-composer-send" icon={cancelling ? 'stop' : 'send'} label={p.action.label} bright disabled={!p.action.enabled} onPress={() => {if (cancelling) p.onCancel(); else {p.onSend(); close();}}}/>
            </View>
          </KeyboardDock>
        </Animated.View>
        </SheetGestureRoot>
      </Animated.View>
    </DragClickBoundary>
    </DrawerGestureBoundary>
  </KeyboardDock>;
}

function Circle({label, icon, size, iconSize, onPress, bright = false, disabled = false}: {label: string; icon: ChatIconName; size: number; iconSize: number; onPress: () => void; bright?: boolean; disabled?: boolean}) {
  const {colors: c, settings: p} = useAppearance();
  return <PressSurface compact accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    surfaceTestID="composer-button-surface" highlightTestID="composer-button-highlight" radius={size / 2} highlightColor={bright ? c.sendIcon : p.selected} highlightOpacity={bright ? 0.08 : 1}
    style={{width: size, height: size}} contentStyle={{backgroundColor: bright ? c.send : c.button, alignItems: 'center', justifyContent: 'center'}}>
    <ChatIcon name={icon} size={iconSize} color={bright ? c.sendIcon : c.buttonIcon}/>
  </PressSurface>;
}
