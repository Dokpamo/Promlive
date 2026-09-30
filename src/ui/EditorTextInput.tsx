import {forwardRef} from 'react';
import {TextInput} from 'react-native';
import type {EditorTextInputProps} from './EditorTextInput.types';
export const EditorTextInput = forwardRef<TextInput, EditorTextInputProps>(({blockerRef: _blocker, ...props}, ref) =>
  <TextInput {...props} ref={ref}/>);
