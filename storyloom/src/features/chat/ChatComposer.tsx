import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Pressable, Text, TextInput, View, useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ChatIcon, type ChatIconName} from './ChatIcon';
import {ComposerInput} from './ComposerInput';
import {DrawerGestureBoundary} from './DrawerGestureBoundary';
import {composerScale, referenceComposer as r} from './chatAppearance';
import {useAppearance} from '../appearance/AppAppearance';
import {SwipeBackBoundary, SwipeBackModal} from '../settings/SwipeBackModal';
import {panelSpring} from './usePanelMotion';

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
  const line = r.lineHeight * s * fontScale;
  const [contentHeight, setContentHeight] = useState(line);
  const [expanded, setExpanded] = useState(false);
  const reportHeight = useCallback((height: number) => setContentHeight(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const filled = p.value.length > 0;
  const measured = Math.max(line, contentHeight);
  const maxHeight = r.maxHeight * s + Math.max(0, fontScale - 1) * line * 2;
  const height = filled ? Math.min(maxHeight, r.firstLineHeight * s + measured - line) : r.compactHeight * s;
  const inputHeight = filled ? Math.max(line, height - (r.firstLineHeight - r.lineHeight) * s) : line;
  const overflowing = filled && measured > inputHeight + 1;
  const expandable = filled && height >= maxHeight - 1;
  const button = r.button * s;
  const hasSend = filled || p.generating;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const motion = useRef({
    height: new Animated.Value(height),
    input: new Animated.Value(inputHeight),
    filled: new Animated.Value(filled ? 1 : 0),
    send: new Animated.Value(hasSend ? 1 : 0),
  }).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReduceMotion(value);});
    const change = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {mounted = false; change.remove();};
  }, []);
  useLayoutEffect(() => {
    const targets: [Animated.Value, number][] = [[motion.height, height], [motion.input, inputHeight], [motion.filled, filled ? 1 : 0], [motion.send, hasSend ? 1 : 0]];
    if (reduceMotion !== false || !p.ready) {
      for (const [value, target] of targets) {value.stopAnimation(); value.setValue(target);}
      return;
    }
    // Retarget from the current size as typing continues; the bottom edge stays fixed.
    const animation = Animated.parallel(targets.map(([value, toValue]) => Animated.spring(value, {...panelSpring, toValue, useNativeDriver: false})));
    animation.start();
    return () => animation.stop();
  }, [filled, hasSend, height, inputHeight, motion, p.ready, reduceMotion]);
  const shape = (empty: number, full: number) => motion.filled.interpolate({inputRange: [0, 1], outputRange: [empty * s, full * s]});
  const actionBottom = shape((r.compactHeight - r.button) / 2, 14);
  return <>
    <DrawerGestureBoundary><View style={{width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: r.inset * s, paddingBottom: p.bottom + r.bottom * s}}>
      <Animated.View testID="chat-composer" style={{height: motion.height, borderRadius: shape(r.compactHeight / 2, 40), overflow: 'hidden', backgroundColor: c.composer, borderWidth: 1 * s, borderColor: c.border, boxShadow: isDark ? undefined : '0px 6px 26px rgba(0, 0, 0, 0.08)'}}>
        <Animated.View style={{position: 'absolute', height: motion.input, overflow: 'hidden', top: motion.filled.interpolate({inputRange: [0, 1], outputRange: [(r.compactHeight * s - line) / 2, 25 * s]}), left: (filled ? 26 : 116) * s, right: (filled ? expandable ? 76 : 26 : 116) * s, transform: [{translateX: shape(filled ? 90 : 0, filled ? 0 : -90)}]}}>
          <ComposerInput value={p.value} onChange={p.onChange} onFocus={() => {}} onHeight={reportHeight} fontSize={r.fontSize * s} lineHeight={r.lineHeight * s} height={inputHeight} scroll={overflowing} ready={p.ready}/>
        </Animated.View>
        {expandable && <Pressable accessibilityRole="button" accessibilityLabel="입력창 크게 열기" hitSlop={8} onPress={() => setExpanded(true)} style={{position: 'absolute', top: 24 * s, right: 29 * s, padding: 3 * s}}><ChatIcon name="expand" size={25 * s} color="#707070"/></Pressable>}
        <Animated.View style={{position: 'absolute', left: shape(20, 12), bottom: actionBottom}}>
          <Circle label="첨부" icon="plus" size={button} iconSize={27 * s} onPress={() => p.onHint('첨부 기능은 아직 연결하지 않았어요.')}/>
        </Animated.View>
        <Animated.View style={{position: 'absolute', right: shape(20, 13), bottom: actionBottom, flexDirection: 'row'}}>
          <Circle label="음성 입력" icon="voice" size={button} iconSize={30 * s} onPress={() => p.onHint('음성 입력은 아직 연결하지 않았어요.')}/>
          <Animated.View pointerEvents={hasSend ? 'auto' : 'none'} aria-hidden={!hasSend} accessibilityElementsHidden={!hasSend} importantForAccessibility={hasSend ? 'auto' : 'no-hide-descendants'} style={{width: Animated.multiply(motion.send, button), marginLeft: Animated.multiply(motion.send, 13 * s), opacity: motion.send, overflow: 'hidden'}}>
            <Circle label={p.generating ? '응답 중단' : '메시지 보내기'} icon={p.generating ? 'stop' : 'send'} size={button} iconSize={25 * s} bright disabled={p.sending || !p.ready || (!p.generating && !p.value.trim())} onPress={p.generating ? p.onCancel : p.onSend}/>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View></DrawerGestureBoundary>
    {expanded && <SwipeBackModal onClose={() => setExpanded(false)}>{close =>
      <SafeAreaView style={{flex: 1, backgroundColor: c.background, paddingHorizontal: 24}}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18}}><Text style={{color: c.text, fontSize: 17}}>메시지 작성</Text><Pressable accessibilityRole="button" accessibilityLabel="입력창 접기" hitSlop={12} onPress={close}><ChatIcon name="close"/></Pressable></View>
        <SwipeBackBoundary style={{flex: 1}}><TextInput accessibilityLabel="확장 메시지 입력" autoFocus multiline value={p.value} onChangeText={p.onChange} maxLength={8000} placeholder="무엇이든 물어보세요." placeholderTextColor={c.placeholder} textAlignVertical="top" style={{flex: 1, color: c.text, fontSize: 18, lineHeight: 28, paddingVertical: 20}}/></SwipeBackBoundary>
        <Pressable accessibilityRole="button" onPress={close} style={{alignSelf: 'flex-end', backgroundColor: c.button, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 24, marginBottom: 16}}><Text style={{color: c.text, fontSize: 15}}>완료</Text></Pressable>
      </SafeAreaView>
    }</SwipeBackModal>}
  </>;
}

function Circle({label, icon, size, iconSize, onPress, bright = false, disabled = false}: {label: string; icon: ChatIconName; size: number; iconSize: number; onPress: () => void; bright?: boolean; disabled?: boolean}) {
  const {colors: c} = useAppearance();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed}) => ({width: size, height: size, borderRadius: size / 2, backgroundColor: bright ? c.send : c.button, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : pressed ? 0.7 : 1})}><ChatIcon name={icon} size={iconSize} color={bright ? c.sendIcon : c.buttonIcon}/></Pressable>;
}
