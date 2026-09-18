export interface ComposerInputProps {
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
