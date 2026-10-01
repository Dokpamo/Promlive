import type {GestureBlockRef} from '../HorizontalGesture.types';
import type {InputMetrics} from './geometry';

export type InputFieldProps = {
  value: string; onChange: (value: string) => void; onFocus: () => void;
  onMeasure: (height: number) => void; metrics: InputMetrics;
  measurementWidth: number; scrollable: boolean; blocker: GestureBlockRef;
};
