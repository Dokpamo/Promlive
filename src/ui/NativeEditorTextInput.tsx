import {forwardRef} from 'react';
import {TextInput} from 'react-native';
import {NativeViewGestureHandler} from 'react-native-gesture-handler';
import type {EditorTextInputProps} from './EditorTextInput.types';

/** Text selection and caret drags keep priority over the enclosing back gesture. */
export const EditorTextInput = forwardRef<TextInput, EditorTextInputProps>(({blockerRef, ...props}, ref) =>
  <NativeViewGestureHandler ref={blockerRef} disallowInterruption shouldActivateOnStart shouldCancelWhenOutside={false}>
    <TextInput {...props} ref={ref}/>
  </NativeViewGestureHandler>);
