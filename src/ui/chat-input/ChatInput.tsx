import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Pressable, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {GestureBlockRef} from '../HorizontalGesture.types';
import type {GalleryImage} from '../cardDetails';
import {Icon, type IconName} from '../Icon';
import {PreviewArtwork} from '../PreviewArtwork';
import {colors} from '../tokens';
import {InputField} from './InputField';
import {ChatKeyboardDock} from './KeyboardDock';
import {inputLayout, inputMetrics, type InputMetrics} from './geometry';

type Props = {value: string; image: GalleryImage | null; blocker: GestureBlockRef;
  onChange: (value: string) => void; onSend: () => void; onAttach: () => void; onRemoveImage: () => void;
  onHeight: (height: number) => void; onFocus: () => void};

export function ChatInput(p: Props) {
  const window = useWindowDimensions(), safe = useSafeAreaInsets(), m = inputMetrics(window.width, window.fontScale);
  const [measured, setMeasured] = useState(m.line);
  const reportHeight = useCallback((height: number) => setMeasured(old => Math.abs(old - height) > 0.5 ? height : old), []);
  const layout = inputLayout(m, p.value ? measured : m.line, !!p.image);
  const [frameHeight, setFrameHeight] = useState(layout.height);
  const motion = useRef(new Animated.Value(layout.height)).current;
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {if (mounted) setReducedMotion(value);});
    const event = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {mounted = false; event?.remove();};
  }, []);
  useLayoutEffect(() => {
    const id = motion.addListener(({value}) => setFrameHeight(value));
    return () => {motion.removeListener(id); motion.stopAnimation();};
  }, [motion]);
  useLayoutEffect(() => {
    motion.stopAnimation();
    if (reducedMotion !== false) {motion.setValue(layout.height); return;}
    const animation = Animated.timing(motion, {toValue: layout.height, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false});
    animation.start(); return () => animation.stop();
  }, [motion, layout.height, reducedMotion]);
  const bottom = safe.bottom + m.gap;
  useLayoutEffect(() => p.onHeight(frameHeight + bottom + 10), [frameHeight, bottom, p.onHeight]);
  const width = Math.min(800, window.width - safe.left - safe.right) - m.gap * 2;
  const left = safe.left + (window.width - safe.left - safe.right - width) / 2;
  const canSend = !!p.value.trim() || !!p.image;
  const textTop = layout.photoHeight + m.textTop;
  return <ChatKeyboardDock safeBottom={safe.bottom}>
    <View pointerEvents="none" style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: frameHeight + bottom + 10, backgroundColor: colors.background}}/>
    <View testID="ui-chat-composer" style={{position: 'absolute', left, width, bottom, height: frameHeight,
      borderRadius: m.radius, borderCurve: 'continuous', backgroundColor: colors.inputSurface}}>
      {p.image && <View testID="ui-chat-input-photo" style={{position: 'absolute', top: m.textTop, left: m.textInset, right: m.actionSide, flexDirection: 'row', justifyContent: 'space-between'}}>
        <View style={{width: m.photoSize, height: m.photoSize, borderRadius: 12, overflow: 'hidden'}}><PreviewArtwork tile={p.image.tile} width={m.photoSize} height={m.photoSize}/></View>
        <InputAction testID="ui-chat-remove-image" label="첨부 이미지 제거" icon="close" metrics={m} onPress={p.onRemoveImage}/>
      </View>}
      <View testID="ui-chat-input-area" style={{position: 'absolute', left: m.textInset, right: m.textInset, top: textTop, height: layout.textHeight}}>
        <InputField value={p.value} onChange={p.onChange} onFocus={p.onFocus} onMeasure={reportHeight} metrics={m}
          measurementWidth={width - m.textInset * 2} scrollable={layout.scrollable} blocker={p.blocker}/>
      </View>
      <View style={{position: 'absolute', left: m.actionSide, bottom: m.actionBottom}}>
        <InputAction testID="ui-chat-plus" label="이미지 첨부" icon="plus" metrics={m} onPress={p.onAttach}/>
      </View>
      <View style={{position: 'absolute', right: m.actionSide, bottom: m.actionBottom}}>
        <InputAction testID="ui-chat-send" label="메시지 전송" icon="send" metrics={m} filled disabled={!canSend} onPress={p.onSend}/>
      </View>
    </View>
  </ChatKeyboardDock>;
}

function InputAction({testID, label, icon, metrics: m, filled = false, disabled = false, onPress}: {
  testID: string; label: string; icon: IconName; metrics: InputMetrics; filled?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    style={({pressed}) => ({width: m.actionSize, height: m.actionSize, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.25 : pressed ? 0.6 : 1})}>
    <View style={{width: m.circleSize, height: m.circleSize, borderRadius: m.circleSize / 2, alignItems: 'center', justifyContent: 'center',
      backgroundColor: filled ? colors.selectedBackground : 'transparent'}}>
      <Icon name={icon} size={m.iconSize} color={filled ? colors.selectedForeground : colors.secondaryForeground}/>
    </View>
  </Pressable>;
}
