import {createContext, useContext, type Ref} from 'react';
import {TextInput, type TextInputProps} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';

export const SheetInputGesture = createContext<{gesture: ReturnType<typeof Gesture.Native>; enabled: boolean} | null>(null);

/** Editing and the parent scroller share touches without cancelling the sheet's edge observer. */
export function SheetTextInput({ref, ...props}: TextInputProps & {ref?: Ref<TextInput>}) {
  const binding = useContext(SheetInputGesture);
  const editor = <TextInput {...props} ref={ref}/>;
  return binding ? <GestureDetector gesture={binding.gesture.enabled(binding.enabled)}>{editor}</GestureDetector> : editor;
}
