import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Pressable, View, useWindowDimensions} from 'react-native';
import {ChatIcon, type ChatIconName} from './ChatIcon';
import {ComposerInput} from './ComposerInput';
import {DrawerGestureBoundary} from './DrawerGestureBoundary';
import {composerScale, referenceComposer as r, typographyScale} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {panelSpring} from './usePanelMotion';
import {ExpandedComposer, type ComposerFrame} from './ExpandedComposer';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onHint: (message: string) => void;
  width: number;
  bottom: number;
  ready: boolean;
  sending: boolean;
  generating: boolean;
}

export function ChatComposer(p: Props) {
  const {colors: c, isDark} = useAppearance();
  const {fontScale} = useWindowDimensions();
  const s = composerScale(p.width);
  const textScale = typographyScale(p.width);
  const line = r.lineHeight * textScale * fontScale;
  const [contentHeight, setContentHeight] = useState(line);
  const [expanded, setExpanded] = useState<ComposerFrame | null>(null);
  const composer = useRef<View>(null);
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const filled = p.value.length > 0;
  const measured = Math.max(line, contentHeight);
  const inputHeight = filled ? Math.min(measured, r.maxLines * line) : line;
  const height = filled ? inputHeight + (r.firstLineHeight - r.lineHeight) * s : r.compactHeight * s;
  const overflowing = filled && measured > inputHeight + 1;
  const expandable = filled && Math.round(measured / line) >= 2;
  const button = r.button * s;
  const hasSend = !!p.value.trim() || p.generating;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const motion = useRef({
    height: new Animated.Value(height),
    input: new Animated.Value(inputHeight),
    filled: new Animated.Value(filled ? 1 : 0),
    expand: new Animated.Value(expandable ? 1 : 0),
    send: new Animated.Value(hasSend ? 1 : 0),
  }).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted = false; change.remove();};
  }, []);
  useLayoutEffect(() => {
    const targets: [Animated.Value, number][] = [[motion.height, height], [motion.input, inputHeight], [motion.filled, filled ? 1 : 0], [motion.expand, expandable ? 1 : 0], [motion.send, hasSend ? 1 : 0]];
    if (reduceMotion !== false || !p.ready) {
      for (const [value, target] of targets) {value.stopAnimation(); value.setValue(target);}
      return;
    }
    // Retarget from the current size as typing continues; the bottom edge stays fixed.
    const animation = Animated.parallel(targets.map(([value, toValue]) => Animated.spring(value, {...panelSpring, toValue, useNativeDriver: false})));
    animation.start();
    return () => animation.stop();
  }, [expandable, filled, hasSend, height, inputHeight, motion, p.ready, reduceMotion]);
  const shape = (empty: number, full: number) => motion.filled.interpolate({inputRange: [0, 1], outputRange: [empty * s, full * s]});
  const actionBottom = shape((r.compactHeight - r.button) / 2, 14);
  const measureComposer = (done: (frame: ComposerFrame) => void, settled = false) => {
    composer.current?.measureInWindow((x, y, width, measuredHeight) => done({x, y: settled ? y + measuredHeight - height : y, width, height: settled ? height : measuredHeight, radius: (filled ? 40 : r.compactHeight / 2) * s}));
  };
  return <>
    <DrawerGestureBoundary><View pointerEvents={expanded ? 'none' : 'auto'} aria-hidden={!!expanded} accessibilityElementsHidden={!!expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'} style={{width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: r.inset * s, paddingBottom: p.bottom + r.bottom * s, opacity: expanded ? 0 : 1}}>
      <Animated.View ref={composer} testID="chat-composer" style={{height: motion.height, borderRadius: shape(r.compactHeight / 2, 40), overflow: 'hidden', backgroundColor: c.composer, borderWidth: 1 * s, borderColor: c.border, boxShadow: isDark ? undefined : '0px 6px 26px rgba(0, 0, 0, 0.08)'}}>
        <Animated.View style={{position: 'absolute', height: motion.input, overflow: 'hidden', top: motion.filled.interpolate({inputRange: [0, 1], outputRange: [(r.compactHeight * s - line) / 2, 25 * s]}), left: (filled ? 26 : 116) * s, right: 26 * s, transform: [{translateX: shape(filled ? 90 : 0, filled ? 0 : -90)}]}}>
          <ComposerInput value={p.value} onChange={p.onChange} onFocus={() => {}} onHeight={reportHeight} fontSize={r.fontSize * textScale} lineHeight={r.lineHeight * textScale} height={inputHeight} scroll={overflowing} ready={p.ready}/>
        </Animated.View>
        <Animated.View style={{position: 'absolute', left: shape(20, 12), bottom: actionBottom}}>
          <Circle label="첨부" icon="plus" size={button} iconSize={27 * s} onPress={() => p.onHint('첨부 기능은 아직 연결하지 않았어요.')}/>
        </Animated.View>
        <Animated.View style={{position: 'absolute', right: shape(20, 13), bottom: actionBottom, flexDirection: 'row'}}>
          <Animated.View pointerEvents={expandable ? 'auto' : 'none'} aria-hidden={!expandable} accessibilityElementsHidden={!expandable} importantForAccessibility={expandable ? 'auto' : 'no-hide-descendants'} style={{width: Animated.multiply(motion.expand, button), opacity: motion.expand, overflow: 'hidden'}}>
            <Circle label="입력창 크게 열기" icon="expand" size={button} iconSize={25 * s} onPress={() => measureComposer(setExpanded)}/>
          </Animated.View>
          <Animated.View pointerEvents={hasSend ? 'auto' : 'none'} aria-hidden={!hasSend} accessibilityElementsHidden={!hasSend} importantForAccessibility={hasSend ? 'auto' : 'no-hide-descendants'} style={{width: Animated.multiply(motion.send, button), marginLeft: Animated.multiply(Animated.multiply(motion.expand, motion.send), 13 * s), opacity: motion.send, overflow: 'hidden'}}>
            <Circle label={p.generating ? '응답 중단' : '메시지 보내기'} icon={p.generating ? 'stop' : 'send'} size={button} iconSize={25 * s} bright disabled={p.sending || !p.ready || (!p.generating && !p.value.trim())} onPress={p.generating ? p.onCancel : p.onSend}/>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View></DrawerGestureBoundary>
    {expanded && <ExpandedComposer origin={expanded} measureOrigin={done => measureComposer(done, true)} sourceInputHeight={inputHeight} sourceExpandable={expandable} value={p.value} onChange={p.onChange} onSend={p.onSend} onCancel={p.onCancel} onClose={() => setExpanded(null)} ready={p.ready} sending={p.sending} generating={p.generating} reduceMotion={reduceMotion === true}/>}
  </>;
}

function Circle({label, icon, size, iconSize, onPress, bright = false, disabled = false}: {label: string; icon: ChatIconName; size: number; iconSize: number; onPress: () => void; bright?: boolean; disabled?: boolean}) {
  const {colors: c} = useAppearance();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed}) => ({width: size, height: size, borderRadius: size / 2, backgroundColor: bright ? c.send : c.button, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : pressed ? 0.7 : 1})}><ChatIcon name={icon} size={iconSize} color={bright ? c.sendIcon : c.buttonIcon}/></Pressable>;
}
