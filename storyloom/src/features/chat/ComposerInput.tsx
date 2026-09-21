import {useImperativeHandle, useRef} from 'react';
import {TextInput} from 'react-native';
import type {ComposerInputProps} from './ComposerInput.types';
import {useAppearance} from '../appearance/AppAppearance';

export function ComposerInput(p: ComposerInputProps) {
  const {colors: c} = useAppearance();
  const input = useRef<TextInput>(null);
  useImperativeHandle(p.focusRef, () => ({focus: () => input.current?.focus()}), []);
  return <TextInput
    ref={input}
    testID={p.testID ?? 'chat-input'}
    accessibilityLabel={p.label ?? '메시지 입력'}
    value={p.value}
    editable={p.ready}
    onChangeText={p.onChange}
    onFocus={p.onFocus}
    onContentSizeChange={e => p.onHeight(e.nativeEvent.contentSize.height)}
    placeholder="무엇이든 물어보세요."
    placeholderTextColor={c.placeholder}
    selectionColor="#3096EB"
    underlineColorAndroid="transparent"
    multiline
    scrollEnabled={p.scroll}
    maxLength={8000}
    textAlignVertical="top"
    style={{height: p.height, width: '100%', padding: 0, margin: 0, borderWidth: 0, color: c.text, fontSize: p.fontSize, lineHeight: p.lineHeight, includeFontPadding: false}}
  />;
}
