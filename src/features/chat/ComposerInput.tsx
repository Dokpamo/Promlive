import {useImperativeHandle, useRef} from 'react';
import {TextInput} from 'react-native';
import type {ComposerInputProps, ComposerSelection} from './ComposerInput.types';
import {useAppearance} from '../appearance/AppAppearance';
import {SheetTextInput} from '../../layout/SheetTextInput';
import {focusWithKeyboard} from '../../layout/focusWithKeyboard';

export function ComposerInput(p: ComposerInputProps) {
  const {colors: c} = useAppearance();
  const input = useRef<TextInput>(null);
  const selection = useRef<ComposerSelection>({start: p.value.length, end: p.value.length});
  const length = useRef(p.value.length);
  length.current = p.value.length;
  useImperativeHandle(p.focusRef, () => {
    const setSelection = (next: ComposerSelection) => {
      const start = Math.max(0, Math.min(next.start, length.current));
      const end = Math.max(start, Math.min(next.end, length.current));
      selection.current = {start, end};
      input.current?.setSelection(start, end);
    };
    return {
      focus: next => {
        if (next) setSelection(next);
        focusWithKeyboard(input.current);
      },
      focusForExpansion: onKeyboardStart => focusWithKeyboard(input.current, onKeyboardStart),
      isFocused: () => input.current?.isFocused() ?? false,
      getSelection: () => selection.current,
      setSelection,
    };
  }, []);
  return <SheetTextInput
    ref={input}
    testID={p.testID ?? 'chat-input'}
    accessibilityLabel={p.label ?? '메시지 입력'}
    value={p.value}
    editable={p.ready}
    onChangeText={p.onChange}
    onFocus={p.onFocus}
    onBlur={p.onBlur}
    onSelectionChange={event => {selection.current = event.nativeEvent.selection; p.onSelectionChange?.(selection.current);}}
    onContentSizeChange={e => p.onHeight(e.nativeEvent.contentSize.height)}
    placeholder="무엇이든 물어보세요."
    placeholderTextColor={c.placeholder}
    selectionColor="#3096EB"
    underlineColorAndroid="transparent"
    multiline
    scrollEnabled={p.scroll}
    maxLength={8000}
    textAlignVertical="top"
    style={{height: p.fillHeight ? '100%' : p.height, width: '100%', padding: 0, margin: 0, borderWidth: 0, color: c.text, fontSize: p.fontSize, lineHeight: p.lineHeight, includeFontPadding: false}}
  />;
}
