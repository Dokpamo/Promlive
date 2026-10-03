import {Platform, Text, TextInput, View} from 'react-native';
import {usePalette} from '../Theme';
import type {InputFieldProps} from './InputField.types';
import {desktopInputProps} from '../desktop/DesktopFeedback';

/** Desktop text editing uses the platform editor without a mobile gesture handler. */
export function InputField(p: InputFieldProps) {
  const colors = usePalette();
  // AppKit's system-font fallback gives Hangul and a Latin space different
  // ascenders. Use one built-in face for both, with natural line metrics, in
  // the editor and measurement so committing a space cannot shift the baseline.
  const typography = {fontSize: p.metrics.fontSize, ...(Platform.OS === 'macos' ? {fontFamily: 'Apple SD Gothic Neo'} : {lineHeight: p.metrics.lineHeight})};
  // Keep the top line pinned until the composer reaches its maximum height.
  // The macOS compatibility patch preserves the clip viewport when disabled.
  const macProps = Platform.OS === 'macos' ? {hideVerticalScrollIndicator: !p.scrollable} : {};
  return <View style={{width: '100%', height: '100%'}}>
    <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
      onTextLayout={event => {const lines = event.nativeEvent.lines, last = lines.at(-1);
        if (last) p.onMeasure(Math.ceil(last.y + last.height), Platform.OS === 'macos' ? Math.ceil(lines[0]!.height) : undefined);}}
      style={[typography, {position: 'absolute', top: 0, left: 0, width: p.measurementWidth - (Platform.OS === 'macos' ? 2 : 0), opacity: 0}]}>{p.value + '\u200b'}</Text>
    <TextInput testID="ui-chat-input" accessibilityLabel="메시지" value={p.value} onChangeText={p.onChange} onFocus={p.onFocus} onBlur={p.onBlur}
      {...desktopInputProps(true, true)} {...macProps} multiline scrollEnabled={p.scrollable} maxLength={p.metrics.maxLength} textAlignVertical="top" underlineColorAndroid="transparent"
      placeholder="메시지 보내기…" placeholderTextColor={colors.secondaryForeground} selectionColor={colors.foreground}
      style={[typography, {width: '100%', height: '100%', padding: 0, margin: 0, color: colors.foreground}]}/>
  </View>;
}
