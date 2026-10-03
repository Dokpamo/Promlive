import {forwardRef, useState} from 'react';
import {StyleSheet, TextInput} from 'react-native';
import type {EditorTextInputProps} from './EditorTextInput.types';
import {useDesktopPane} from './desktop/DesktopPane';
import {FieldOutline, HoverPressable, desktopInputProps, desktopInputStyle} from './desktop/DesktopFeedback';
export const EditorTextInput = forwardRef<TextInput, EditorTextInputProps>(({blockerRef: _blocker, ...props}, ref) => {
  const desktop = useDesktopPane(), [focused, setFocused] = useState(false);
  if (!desktop) return <TextInput {...props} ref={ref}/>;
  const {onLayout, ...inputProps} = props;
  return <HoverPressable accessible={false} focusable={false} feedback="none" onLayout={onLayout}>{hovered => <>
    <TextInput {...inputProps} ref={ref} {...desktopInputProps(true, props.multiline)} style={[props.style, desktopInputStyle(true)]}
      onFocus={event => {setFocused(true); props.onFocus?.(event);}} onBlur={event => {setFocused(false); props.onBlur?.(event);}}/>
    <FieldOutline focused={focused} hovered={hovered} radius={StyleSheet.flatten(props.style)?.borderRadius ?? 12} testID={props.testID ? `${props.testID}-outline` : undefined}/>
  </>}</HoverPressable>;
});
