import type {Ref} from 'react';

export interface ComposerSelection {start: number; end: number}

export interface ComposerInputHandle {
  focus: (selection?: ComposerSelection) => void;
  isFocused: () => boolean;
  getSelection: () => ComposerSelection;
  setSelection: (selection: ComposerSelection) => void;
}

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
  fillHeight?: boolean;
  scroll: boolean;
  ready: boolean;
}
