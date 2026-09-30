import type {TextInputProps} from 'react-native';
import type {GestureBlockRef} from './HorizontalGesture.types';
export type EditorTextInputProps = TextInputProps & {blockerRef?: GestureBlockRef};
