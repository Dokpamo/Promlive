import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardDock} from '../../layout/KeyboardMotion';
import {PressSurface} from '../../layout/PressSurface';
import {EdgeTint} from '../../layout/EdgeTint';
import {ChatIcon, type ChatIconName} from './ChatIcon';
import {ComposerInput} from './ComposerInput';
import type {ComposerInputHandle, ComposerSelection} from './ComposerInput.types';
import {DrawerGestureBoundary, useDrawerModalLock} from './DrawerGestureBoundary';
import {composerScale, referenceComposer as r, typographyScale} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {panelSpringForDistance} from '../../layout/panelAnimation';
import {SheetScrollView} from '../../layout/SheetScrollView';
import {SheetGestureRoot} from '../../layout/SheetGestureRoot';
import type {SheetScrollState} from '../../layout/sheetMotion';
import {useComposerLayoutFrame} from './useComposerLayoutFrame';
import {ExpandedComposer} from './ExpandedComposer';
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

/** The dock stays mounted underneath the independent full-screen editor. */
export function ChatComposer(p: Props) {
  const {colors: c, isDark} = useAppearance();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = composerScale(p.width);
  const textScale = typographyScale(p.width);
  const line = r.lineHeight * textScale * window.fontScale;
  const [contentHeight, setContentHeight] = useState(line);
  const [editor, setEditor] = useState<{selection: ComposerSelection; closing: boolean} | null>(null);
  const modal = editor !== null;
  const covered = modal && !editor.closing;
  const input = useRef<ComposerInputHandle>(null);
  const restore = useRef<{selection: ComposerSelection; focus: boolean} | null>(null);
  const callbacks = useRef(p);
  callbacks.current = p;
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const filled = p.value.length > 0;
  const measured = filled ? Math.max(line, contentHeight) : line;
  const inputHeight = Math.min(measured, r.maxLines * line);
  const height = filled ? inputHeight + (r.firstLineHeight - r.lineHeight) * s : r.compactHeight * s;
  const expandable = filled && Math.round(measured / line) >= 2;
  const cancelling = p.action.kind === 'cancel';
  const hasSend = !!p.value.trim() || cancelling;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const motion = useRef({
    height: new Animated.Value(height), filled: new Animated.Value(filled ? 1 : 0),
    expand: new Animated.Value(expandable ? 1 : 0), send: new Animated.Value(hasSend ? 1 : 0),
  }).current;
  const frame = useComposerLayoutFrame(motion, {height, filled: filled ? 1 : 0});
  const fraction = useRef(new Animated.Value(1)).current.interpolate({inputRange: [0, 1], outputRange: [1, 1]});
  useDrawerModalLock(modal);
  useLayoutEffect(() => {callbacks.current.onExpandedChange?.(modal);}, [modal]);
  useLayoutEffect(() => {
    if (covered || !restore.current) return;
    if (restore.current.focus) input.current?.focus(restore.current.selection);
    else input.current?.setSelection(restore.current.selection);
  }, [covered]);
  useEffect(() => {
    if (modal || !restore.current) return;
    const target = restore.current;
    // Fabric can move focus when the outgoing native input is finally removed.
    const frame = requestAnimationFrame(() => {
      if (target.focus) input.current?.focus(target.selection);
      restore.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [modal]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted = false; change.remove();};
  }, []);
  useLayoutEffect(() => {
    const targets: [Animated.Value, number][] = [[motion.height, height], [motion.filled, filled ? 1 : 0], [motion.expand, expandable ? 1 : 0], [motion.send, hasSend ? 1 : 0]];
    if (modal || reduceMotion !== false || !p.ready) {
      for (const [value, to] of targets) {value.stopAnimation(); value.setValue(to);}
      return;
    }
    const resizing = Animated.parallel(targets.map(([value, toValue]) => Animated.spring(value, {...panelSpringForDistance(), toValue, useNativeDriver: false})));
    resizing.start();
    return () => resizing.stop();
  }, [expandable, filled, hasSend, height, modal, motion, p.ready, reduceMotion]);
  useEffect(() => {
    const listener = motion.height.addListener(({value}) => callbacks.current.onHeight?.(value + p.bottom + r.bottom * s));
    callbacks.current.onHeight?.(height + p.bottom + r.bottom * s);
    return () => motion.height.removeListener(listener);
  }, [height, motion.height, p.bottom, s]);

  const scroll = useRef<SheetScrollState>({offset: 0, canScroll: false, maxOffset: 0});
  const canScrollInput = useCallback(() => {
    const selection = input.current?.getSelection();
    return !selection || selection.start === selection.end;
  }, []);
  const shape = (empty: number, full: number) => (empty + (full - empty) * frame.filled) * s;
  const width = Math.min(800, window.width - insets.left - insets.right) - 2 * r.inset * s;
  const left = insets.left + (window.width - insets.left - insets.right - width) / 2;
  const textWidth = Math.max(1, Math.min(width - 54 * s, window.width - 52 * s));
  const scrollable = measured > inputHeight + 1;
  scroll.current.canScroll = scrollable;
  scroll.current.maxOffset = Math.max(0, measured - inputHeight);
  const button = r.button * s;
  const actionBottom = shape((r.compactHeight - r.button) / 2, 14);

  return <DrawerGestureBoundary style={{position: 'absolute', inset: 0}}>
    <KeyboardDock fraction={fraction} bottomInset={p.bottom} freezeKeyboard={false} followCaret={!covered}>
      <View pointerEvents={covered ? 'none' : 'box-none'} aria-hidden={covered} accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'} style={{flex: 1}}>
        <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: frame.height + p.bottom + (r.bottom + 40) * s}}>
          <EdgeTint edge="bottom" testID="composer-tint" style={{flex: 1}}/>
        </View>
        <View nativeID="promlive-composer-surface" testID="chat-composer" style={{position: 'absolute', left, width, bottom: p.bottom + r.bottom * s, height: frame.height,
          borderRadius: shape(r.compactHeight / 2, 40), borderWidth: s, borderColor: c.border, backgroundColor: c.composer, overflow: 'hidden',
          boxShadow: isDark ? undefined : '0px 6px 26px rgba(0, 0, 0, 0.08)',
        }}>
          <SheetGestureRoot>
            {/* Text gets its final viewport with its content. Only the outer bar animates. */}
            <View testID="composer-scroll-viewport" style={{position: 'absolute', left: filled ? (width - textWidth) / 2 - s : 116 * s,
              width: filled ? textWidth : width - 144 * s, top: shape((r.compactHeight - line / s) / 2, 25), height: inputHeight, overflow: 'hidden'}}>
              <SheetScrollView testID="composer-scroll" nativeID="promlive-composer-scroll" sheetScroll={scroll} sheetDrag={null} canStartInputScroll={canScrollInput} scrollEnabled={scrollable}
                bounces={false} overScrollMode="never" keyboardShouldPersistTaps="always" keyboardDismissMode="none" contentInsetAdjustmentBehavior="never" automaticallyAdjustKeyboardInsets={false}
                showsVerticalScrollIndicator={false} scrollEventThrottle={16} style={{flex: 1}} onScroll={event => {scroll.current.offset = event.nativeEvent.contentOffset.y;}}>
                <View style={{height: measured}}>
                  <ComposerInput focusRef={input} value={p.value} onChange={p.onChange} onFocus={() => {}} onHeight={reportHeight} fontSize={r.fontSize * textScale}
                    lineHeight={r.lineHeight * textScale} height={measured} fillHeight scroll={false} ready={p.ready}/>
                </View>
              </SheetScrollView>
            </View>
            <View style={{position: 'absolute', left: shape(20, 12), bottom: actionBottom}}>
              <Circle label="첨부" icon="plus" size={button} iconSize={27 * s} onPress={() => p.onHint('첨부 기능은 아직 연결하지 않았어요.')}/>
            </View>
            <Animated.View pointerEvents={expandable ? 'auto' : 'none'} aria-hidden={!expandable} accessibilityElementsHidden={!expandable} importantForAccessibility={expandable ? 'auto' : 'no-hide-descendants'}
              style={{position: 'absolute', bottom: actionBottom, right: Animated.add(13 * s, Animated.multiply(motion.send, button + 13 * s)), opacity: motion.expand,
                transform: [{scale: motion.expand.interpolate({inputRange: [0, 1], outputRange: [0.6, 1]})}]}}>
              <Circle label="입력창 크게 열기" icon="expand" size={button} iconSize={25 * s} onPress={() => {restore.current = null; setEditor({selection: input.current?.getSelection() ?? {start: p.value.length, end: p.value.length}, closing: false});}}/>
            </Animated.View>
            <Animated.View testID="composer-send-entrance" pointerEvents={hasSend ? 'auto' : 'none'} aria-hidden={!hasSend} accessibilityElementsHidden={!hasSend} importantForAccessibility={hasSend ? 'auto' : 'no-hide-descendants'}
              style={{position: 'absolute', right: 13 * s, bottom: actionBottom, opacity: motion.send,
                transform: [{scale: motion.send.interpolate({inputRange: [0, 1], outputRange: [0.6, 1]})}]}}>
              <Circle label={p.action.label} icon={cancelling ? 'stop' : 'send'} size={button} iconSize={25 * s} bright disabled={!p.action.enabled} onPress={cancelling ? p.onCancel : p.onSend}/>
            </Animated.View>
          </SheetGestureRoot>
        </View>
      </View>
    </KeyboardDock>
    {editor && <ExpandedComposer value={p.value} onChange={p.onChange} onSend={p.onSend} onCancel={p.onCancel} action={p.action} ready={p.ready}
      width={p.width} textWidth={textWidth} initialHeight={measured} initialSelection={editor.selection}
      onReturnFocus={(selection, focus) => {restore.current = {selection, focus}; setEditor(current => current && {...current, closing: true});}} onClose={() => setEditor(null)}/>}
  </DrawerGestureBoundary>;
}

function Circle({label, icon, size, iconSize, onPress, bright = false, disabled = false}: {label: string; icon: ChatIconName; size: number; iconSize: number; onPress: () => void; bright?: boolean; disabled?: boolean}) {
  const {colors: c, settings: p} = useAppearance();
  return <PressSurface compact accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    surfaceTestID="composer-button-surface" highlightTestID="composer-button-highlight" radius={size / 2} highlightColor={bright ? c.sendIcon : p.selected} highlightOpacity={bright ? 0.08 : 1}
    style={{width: size, height: size}} contentStyle={{backgroundColor: bright ? c.send : c.button, alignItems: 'center', justifyContent: 'center'}}>
    <ChatIcon name={icon} size={iconSize} color={bright ? c.sendIcon : c.buttonIcon}/>
  </PressSurface>;
}
