import {KeyboardAvoidingView, Platform, type ViewProps} from 'react-native';

export type KeyboardPageProps = ViewProps & {keyboardVerticalOffset?: number};
export function KeyboardPage(props: KeyboardPageProps) {
  return <KeyboardAvoidingView {...props} behavior={Platform.OS === 'ios' ? 'padding' : undefined}/>;
}
