import {useMemo} from 'react';
import {Text, TextInput, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import type {InputFieldProps} from './InputField.types';
import {colors} from '../tokens';

/** One native editor owns focus, selection and internal scrolling for its lifetime. */
export function InputField(p: InputFieldProps) {
  const gesture = useMemo(() => Gesture.Native().shouldActivateOnStart(true).shouldCancelWhenOutside(false)
    .withRef(p.blocker as unknown as Parameters<ReturnType<typeof Gesture.Native>['withRef']>[0]), [p.blocker]);
  const typography = {fontSize: p.metrics.fontSize, lineHeight: p.metrics.lineHeight, includeFontPadding: false};
  return <View style={{width: '100%', height: '100%'}}>
    {/* Measure at the final text width, independent of the capsule's animated size.
        Fabric iOS does not reliably report content-size changes in a fixed editor. */}
    <Text testID="ui-input-measure" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
      onTextLayout={event => {const last = event.nativeEvent.lines.at(-1); if (last) p.onMeasure(Math.ceil(last.y + last.height));}}
      style={[typography, {position: 'absolute', top: 0, left: 0, width: p.measurementWidth, opacity: 0}]}>{p.value + '\u200b'}</Text>
    <GestureDetector gesture={gesture}>
      <TextInput testID="ui-chat-input" accessibilityLabel="메시지" value={p.value} onChangeText={p.onChange} onFocus={p.onFocus}
        multiline scrollEnabled={p.scrollable} maxLength={p.metrics.maxLength} textAlignVertical="top" underlineColorAndroid="transparent"
        placeholder="메시지 보내기…" placeholderTextColor={colors.secondaryForeground} selectionColor={colors.foreground}
        style={[typography, {width: '100%', height: '100%', padding: 0, margin: 0, color: colors.foreground}]}/>
    </GestureDetector>
  </View>;
}
