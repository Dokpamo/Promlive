import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, View, useWindowDimensions, type ScrollView} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {KeyboardDock, useKeyboardFrame} from '../../layout/KeyboardMotion';
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
import {clampEditorScroll, type EditorScrollRestore} from '../../layout/editorScroll';

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
  const keyboard = useKeyboardFrame();
  const s = composerScale(p.width);
  const textScale = typographyScale(p.width);
  const line = r.lineHeight * textScale * window.fontScale;
  const [contentHeight, setContentHeight] = useState(line);
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState<{selection: ComposerSelection; scrollOffset: number; closing: boolean} | null>(null);
  const modal = editor !== null;
  const covered = modal && !editor.closing;
  const input = useRef<ComposerInputHandle>(null);
  const restore = useRef<{selection: ComposerSelection; focus: boolean} | null>(null);
  const scroller = useRef<ScrollView>(null);
  const scroll = useRef<SheetScrollState>({offset: 0, canScroll: false, maxOffset: 0});
  const [scrollRestore, setScrollRestore] = useState<EditorScrollRestore | null>(null);
  const scrollRevision = useRef(0);
  const cancelRestoration = () => {restore.current = null; setScrollRestore(null);};
  const restoreReading = useCallback(() => {
    if (!scrollRestore) return;
    const y = clampEditorScroll(scrollRestore.offset, scroll.current.maxOffset ?? 0);
    scroller.current?.scrollTo({y, animated: false});
  }, [scrollRestore]);
  const callbacks = useRef(p);
  callbacks.current = p;
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const hasText = p.value.length > 0;
  const filled = hasText || editing;
  const measured = hasText ? Math.max(line, contentHeight) : line;
  const inputHeight = Math.min(measured, r.maxLines * line);
  const height = filled ? inputHeight + (r.firstLineHeight - r.lineHeight) * s : r.compactHeight * s;
  const expandable = filled && Math.round(measured / line) >= 2;
  const cancelling = p.action.kind === 'cancel';
  const hasSend = !!p.value.trim() || cancelling;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const motion = useRef({
    height: new Animated.Value(height), filled: new Animated.Value(filled ? 1 : 0),
    expand: new Animated.Value(expandable ? 1 : 0),
  }).current;
  const frame = useComposerLayoutFrame(motion, {height, filled: filled ? 1 : 0});
  const fraction = useRef(new Animated.Value(1)).current.interpolate({inputRange: [0, 1], outputRange: [1, 1]});
  useDrawerModalLock(covered);
  useLayoutEffect(() => {callbacks.current.onExpandedChange?.(covered);}, [covered]);
  const lastKeyboardHeight = useRef(keyboard.height);
  useEffect(() => {
    if (!modal && lastKeyboardHeight.current > 0 && keyboard.height === 0) setEditing(false);
    lastKeyboardHeight.current = keyboard.height;
  }, [keyboard.height, modal]);
  useLayoutEffect(() => {
    if (covered || !restore.current) return;
    if (restore.current.focus) input.current?.focus(restore.current.selection);
    else input.current?.setSelection(restore.current.selection);
    restoreReading();
  }, [covered, restoreReading]);
  useEffect(() => {
    if (modal || !restore.current) return;
    const target = restore.current;
    // Fabric can move focus when the outgoing native input is finally removed.
    const frame = requestAnimationFrame(() => {
      if (target.focus) input.current?.focus(target.selection);
      restoreReading();
      restore.current = null;
      setScrollRestore(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [modal, restoreReading]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted = false; change.remove();};
  }, []);
  useLayoutEffect(() => {
    const targets: [Animated.Value, number][] = [[motion.height, height], [motion.filled, filled ? 1 : 0], [motion.expand, expandable ? 1 : 0]];
    if (modal || reduceMotion !== false || !p.ready) {
      for (const [value, to] of targets) {value.stopAnimation(); value.setValue(to);}
      return;
    }
    const resizing = Animated.parallel(targets.map(([value, toValue]) => Animated.spring(value, {...panelSpringForDistance(), toValue, useNativeDriver: false})));
    resizing.start();
    return () => resizing.stop();
  }, [expandable, filled, height, modal, motion, p.ready, reduceMotion]);
  useEffect(() => {
    const listener = motion.height.addListener(({value}) => callbacks.current.onHeight?.(value + p.bottom + r.bottom * s));
    callbacks.current.onHeight?.(height + p.bottom + r.bottom * s);
    return () => motion.height.removeListener(listener);
  }, [height, motion.height, p.bottom, s]);

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
    <KeyboardDock fraction={fraction} bottomInset={p.bottom} freezeKeyboard={false} followCaret={!covered} restoreScroll={scrollRestore ?? undefined}>
      {/* Keep the focused input's native ancestors mounted when covering the dock. */}
      <View collapsable={false} pointerEvents={covered ? 'none' : 'box-none'} aria-hidden={covered} accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'} style={{flex: 1}}>
        <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: frame.height + p.bottom + (r.bottom + 40) * s}}>
          <EdgeTint edge="bottom" testID="composer-tint" style={{flex: 1}}/>
        </View>
        <View testID="composer-controls-layer" pointerEvents="box-none" style={{position: 'absolute', left, width, bottom: p.bottom + r.bottom * s, height: frame.height, overflow: 'visible'}}>
        <View nativeID="promlive-composer-surface" testID="chat-composer" style={{position: 'absolute', inset: 0, height: frame.height,
          borderRadius: shape(r.compactHeight / 2, 40), borderWidth: s, borderColor: c.border, backgroundColor: c.composer, overflow: 'hidden',
          boxShadow: isDark ? undefined : '0px 6px 26px rgba(0, 0, 0, 0.08)',
        }}>
          <SheetGestureRoot>
            {/* Text gets its final viewport with its content. Only the outer bar animates. */}
            <View testID="composer-scroll-viewport" style={{position: 'absolute', left: filled ? (width - textWidth) / 2 - s : 116 * s,
              width: filled ? textWidth : width - 144 * s, top: shape((r.compactHeight - line / s) / 2, 25), height: inputHeight, overflow: 'hidden'}}>
              <SheetScrollView ref={scroller} testID="composer-scroll" nativeID="promlive-composer-scroll" sheetScroll={scroll} sheetDrag={null} canStartInputScroll={canScrollInput} scrollEnabled={scrollable}
                onLayout={restoreReading} onContentSizeChange={restoreReading} onScrollBeginDrag={cancelRestoration}
                bounces={false} overScrollMode="never" keyboardShouldPersistTaps="always" keyboardDismissMode="none" contentInsetAdjustmentBehavior="never" automaticallyAdjustKeyboardInsets={false}
                showsVerticalScrollIndicator={false} scrollEventThrottle={16} style={{flex: 1}} onScroll={event => {scroll.current.offset = event.nativeEvent.contentOffset.y;}}>
                <View style={{height: measured}}>
                  <ComposerInput focusRef={input} value={p.value} onChange={value => {cancelRestoration(); if (value.length) setEditing(true); p.onChange(value);}} onFocus={() => setEditing(true)}
                    onSelectionChange={selection => {
                      const target = restore.current?.selection;
                      if (!covered && target && (selection.start !== target.start || selection.end !== target.end)) cancelRestoration();
                    }}
                    onBlur={() => {if (!modal) setEditing(false);}} onHeight={reportHeight} fontSize={r.fontSize * textScale}
                    lineHeight={r.lineHeight * textScale} height={measured} fillHeight scroll={false} ready={p.ready}/>
                </View>
              </SheetScrollView>
            </View>
            <View style={{position: 'absolute', left: shape(20, 12), bottom: actionBottom}}>
              <Circle label="첨부" icon="plus" size={button} iconSize={27 * s} onPress={() => p.onHint('첨부 기능은 아직 연결하지 않았어요.')}/>
            </View>
            <Animated.View pointerEvents={expandable ? 'auto' : 'none'} aria-hidden={!expandable} accessibilityElementsHidden={!expandable} importantForAccessibility={expandable ? 'auto' : 'no-hide-descendants'}
              style={{position: 'absolute', bottom: actionBottom, right: 13 * s + (hasSend ? button + 13 * s : 0), opacity: motion.expand,
                transform: [{scale: motion.expand.interpolate({inputRange: [0, 1], outputRange: [0.6, 1]})}]}}>
              <Circle label="입력창 크게 열기" icon="expand" size={button} iconSize={25 * s} onPress={() => {restore.current = null; setScrollRestore(null); setEditing(true); setEditor({selection: input.current?.getSelection() ?? {start: p.value.length, end: p.value.length}, scrollOffset: scroll.current.offset, closing: false});}}/>
            </Animated.View>
          </SheetGestureRoot>
        </View>
        {hasSend && <View testID="composer-send-control" style={{position: 'absolute', zIndex: 1, right: 14 * s, bottom: actionBottom + s}}>
          <Circle label={p.action.label} icon={cancelling ? 'stop' : 'send'} size={button} iconSize={25 * s} bright disabled={!p.action.enabled} onPress={cancelling ? p.onCancel : p.onSend}/>
        </View>}
        </View>
      </View>
    </KeyboardDock>
    {editor && <ExpandedComposer value={p.value} onChange={p.onChange} onSend={p.onSend} onCancel={p.onCancel} action={p.action} ready={p.ready}
      width={p.width} textWidth={textWidth} initialHeight={measured} initialSelection={editor.selection} initialScrollOffset={editor.scrollOffset}
      onReturnFocus={(selection, focus, offset, revealCaret) => {
        restore.current = {selection, focus};
        setScrollRestore({offset, revealCaret, revision: ++scrollRevision.current});
        setEditing(focus); setEditor(current => current && {...current, closing: true});
      }} onClose={() => setEditor(null)}/>}
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
