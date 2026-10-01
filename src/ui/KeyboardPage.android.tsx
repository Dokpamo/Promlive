import {useState} from 'react';
import {View, type ViewProps} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NativeKeyboardSurface} from './chat-input/NativeKeyboardSurface';

// The app keeps its Android window fixed. Use actual IME insets, including the
// final zero frame, rather than RN's screenY estimate after keyboard dismissal.
export function KeyboardPage({children, style, keyboardVerticalOffset: _offset, ...props}: ViewProps & {keyboardVerticalOffset?: number}) {
  const [height, setHeight] = useState(0);
  const safe = useSafeAreaInsets();
  return <NativeKeyboardSurface style={{flex: 1, minHeight: 0}} onKeyboardFrame={event => setHeight(event.nativeEvent.height)}>
    <View {...props} style={[style, {marginBottom: Math.max(0, height - safe.bottom)}]}>{children}</View>
  </NativeKeyboardSurface>;
}
