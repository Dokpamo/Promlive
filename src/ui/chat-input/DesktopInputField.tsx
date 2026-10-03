import {Platform, Text, TextInput, View} from 'react-native';
import {usePalette} from '../Theme';
import type {InputFieldProps} from './InputField.types';

/** Desktop text editing uses the platform editor without a mobile gesture handler. */
export function InputField(p: InputFieldProps) {
  const colors = usePalette();
  const typography = {fontSize: p.metrics.fontSize, lineHeight: p.metrics.lineHeight};
  // RN macOS constrains a disabled NSTextView scroll viewport to a zero-sized rect.
  // Keep the native viewport enabled; the composer already caps its visible height.
  const macProps = Platform.OS === 'macos' ? {hideVerticalScrollIndicator: !p.scrollable, enableFocusRing: false} : {};
  return <View style={{width: '100%', height: '100%'}}>
    <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
      onTextLayout={event => {const last = event.nativeEvent.lines.at(-1); if (last) p.onMeasure(Math.ceil(last.y + last.height));}}
      style={[typography, {position: 'absolute', top: 0, left: 0, width: p.measurementWidth, opacity: 0}]}>{p.value + '\u200b'}</Text>
    <TextInput testID="ui-chat-input" accessibilityLabel="메시지" value={p.value} onChangeText={p.onChange} onFocus={p.onFocus} onBlur={p.onBlur}
      {...macProps} multiline scrollEnabled={Platform.OS === 'macos' || p.scrollable} maxLength={p.metrics.maxLength} textAlignVertical="top" underlineColorAndroid="transparent"
      placeholder="메시지 보내기…" placeholderTextColor={colors.secondaryForeground} selectionColor={colors.foreground}
      style={[typography, {width: '100%', height: '100%', padding: 0, margin: 0, color: colors.foreground}]}/>
  </View>;
}
