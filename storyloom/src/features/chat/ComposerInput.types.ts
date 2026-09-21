import type {Ref} from 'react';

export interface ComposerInputHandle {focus: () => void}

export interface ComposerInputProps {
  focusRef?: Ref<ComposerInputHandle>;
  testID?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onHeight: (height: number) => void;
  onFocus: () => void;
  fontSize: number;
  lineHeight: number;
  height: number;
  scroll: boolean;
  ready: boolean;
}
