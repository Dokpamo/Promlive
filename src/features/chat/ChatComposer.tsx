import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, BackHandler, Platform, Pressable, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HeaderButton, ScreenHeader} from '../../layout/ScreenHeader';
import {KeyboardDock, useKeyboardFrame} from '../../layout/KeyboardMotion';
import {PressSurface} from '../../layout/PressSurface';
import {FrostedEdge} from '../../layout/FrostedEdge';
import {ChatIcon, type ChatIconName} from './ChatIcon';
import {ComposerInput} from './ComposerInput';
import type {ComposerInputHandle} from './ComposerInput.types';
import {DrawerGestureBoundary, useDrawerModalLock} from './DrawerGestureBoundary';
import {composerScale, headerScale, referenceComposer as r, referenceHeader, typographyScale} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {panelSpringForDistance} from './panelAnimation';
import {composerEditorHeight, expandedComposerFrame} from './composerGeometry';
import {DragClickBoundary} from '../settings/DragClickBoundary';
import {settingsReference} from '../settings/settingsGeometry';
import {useComposerPull} from './useComposerPull';
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
    setExpanded(open);
    if (open) setVisible(true);
    const finish = () => {if (mounted.current && generation.current === attempt && !open) setVisible(false);};
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
  const pull = useComposerPull(drag, {
    travel: sheet.height, ready: () => visible,
    grab: () => {generation.current++; animation.current?.stop(); setExpanded(true);},
    restore: () => settle(true), close,
  });
  const blend = (from: number | Animated.Animated, to: number) => Animated.add(from, Animated.multiply(progress, Animated.subtract(to, from)));
  const shape = (empty: number, full: number) => motion.filled.interpolate({inputRange: [0, 1], outputRange: [empty * s, full * s]});
  const collapsedWidth = Math.min(800, window.width - insets.left - insets.right) - 2 * r.inset * s;
  const collapsedLeft = insets.left + (window.width - insets.left - insets.right - collapsedWidth) / 2;
  const sheetInset = settingsReference.sheetInset * s;
  const inputTop = sheetInset + referenceHeader.barHeight * headerScale(p.width) + 16 * s;
  const editorHeight = composerEditorHeight(sheet, inputTop, measured, line, 26 * s, window.height - keyboard.height);
  const activeHeight = visible ? editorHeight : inputHeight;
  const button = r.button * s;
  const actionBottom = shape((r.compactHeight - r.button) / 2, 14);
  const collapsedOpacity = progress.interpolate({inputRange: [0, 0.3, 1], outputRange: [1, 0, 0], extrapolate: 'clamp'});
  const expandedOpacity = progress.interpolate({inputRange: [0, 0.45, 1], outputRange: [0, 0, 1], extrapolate: 'clamp'});
  const fraction = progress.interpolate({inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp'});

  return <KeyboardDock fraction={fraction} bottomInset={p.bottom} freezeKeyboard={expanded || preparing} followCaret={modal}>
    <DrawerGestureBoundary style={{flex: 1}}>
    <DragClickBoundary cancelClick={pull.cancelClick}>
      <Animated.View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: Animated.add(motion.height, p.bottom + (r.bottom + 40) * s), opacity: fraction}}>
        <FrostedEdge edge="bottom" testID="composer-frost" style={{flex: 1}}/>
      </Animated.View>
      {modal && <Pressable accessibilityRole="button" accessibilityLabel="입력창 바깥 눌러 접기" onPress={close} style={{position: 'absolute', inset: 0}}/>}
      <Animated.View testID={visible ? 'expanded-composer-surface' : 'chat-composer'} accessibilityViewIsModal={visible} onAccessibilityEscape={visible ? close : undefined} {...pull.panHandlers} style={{
        position: 'absolute', left: blend(collapsedLeft, sheet.x), width: blend(collapsedWidth, sheet.width),
        bottom: blend(p.bottom + r.bottom * s, window.height - sheet.y - sheet.height), height: blend(motion.height, sheet.height),
        borderRadius: blend(shape(r.compactHeight / 2, 40), sheet.radius), borderWidth: blend(s, 0), borderColor: c.border,
        backgroundColor: progress.interpolate({inputRange: [0, 1], outputRange: [c.composer, settings.sheet]}), overflow: 'hidden',
        boxShadow: isDark ? undefined : '0px 6px 26px rgba(0, 0, 0, 0.08)', transform: [{translateX: drag.x}, {translateY: drag.y}],
      }}>
        <Animated.View onStartShouldSetResponderCapture={pull.blockInput} style={{position: 'absolute', left: blend((filled ? 26 : 116) * s, 26 * s), right: 26 * s, top: blend(shape((r.compactHeight - line / s) / 2, 25), inputTop), height: blend(motion.input, editorHeight), overflow: 'hidden'}}>
          <ComposerInput focusRef={input} testID={visible ? 'expanded-composer-input' : 'chat-input'} label={visible ? '확장 메시지 입력' : '메시지 입력'} value={p.value} onChange={p.onChange} onFocus={() => {}} onHeight={reportHeight} fontSize={r.fontSize * textScale} lineHeight={r.lineHeight * textScale} height={activeHeight} fillHeight scroll={measured > activeHeight + 1} ready={p.ready}/>
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
        <Animated.View testID="expanded-composer-handle" pointerEvents="none" accessible={false} style={{position: 'absolute', alignSelf: 'center', top: settingsReference.sheetHandle.top * s, width: settingsReference.sheetHandle.width * s, height: settingsReference.sheetHandle.height * s, borderRadius: settingsReference.sheetHandle.radius * s, backgroundColor: settings.divider, opacity: expandedOpacity}}/>
        <Animated.View pointerEvents={expanded ? 'box-none' : 'none'} aria-hidden={!visible} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={{position: 'absolute', top: sheetInset, left: 0, right: 0, opacity: expandedOpacity}}>
          <ScreenHeader width={p.width} testID="expanded-composer-header" frosted={false}>
            <HeaderButton width={p.width} testID="expanded-composer-close" icon="close" label="입력창 접기" onPress={close}/>
            <View style={{flex: 1}} pointerEvents="none"/>
            <HeaderButton width={p.width} testID="expanded-composer-send" icon={cancelling ? 'stop' : 'send'} label={p.action.label} bright disabled={!p.action.enabled} onPress={() => {if (cancelling) p.onCancel(); else {p.onSend(); close();}}}/>
          </ScreenHeader>
        </Animated.View>
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
