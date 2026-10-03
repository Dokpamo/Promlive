import {Platform, Text, TextInput, View} from 'react-native';
import {usePalette} from '../Theme';
import type {InputFieldProps} from './InputField.types';

/** Desktop text editing uses the platform editor without a mobile gesture handler. */
export function InputField(p: InputFieldProps) {
  const colors = usePalette();
  // AppKit's system-font fallback gives Hangul and a Latin space different
  // ascenders. Use one built-in face for both, with natural line metrics, in
  // the editor and measurement so committing a space cannot shift the baseline.
  const typography = {fontSize: p.metrics.fontSize, ...(Platform.OS === 'macos' ? {fontFamily: 'Apple SD Gothic Neo'} : {lineHeight: p.metrics.lineHeight})};
  // RN macOS collapses its clip viewport with scrollEnabled=false. Let AppKit
  // manage the viewport even for short drafts; only show a scroller on overflow.
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
