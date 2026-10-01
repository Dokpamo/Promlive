import {useLayoutEffect, useRef} from 'react';
import type {InputFieldProps} from './InputField.types';
import {colors} from '../tokens';

export function InputField(p: InputFieldProps) {
  const measurement = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (measurement.current) p.onMeasure(measurement.current.scrollHeight);
  }, [p.value, p.measurementWidth, p.metrics.fontSize, p.metrics.lineHeight, p.onMeasure]);
  const style = {padding: 0, margin: 0, border: 0, background: 'transparent', color: colors.foreground,
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    fontSize: p.metrics.fontSize, lineHeight: `${p.metrics.lineHeight}px`, fontWeight: 400,
    resize: 'none', boxSizing: 'border-box'} as const;
  return <>
    <textarea ref={measurement} tabIndex={-1} aria-hidden readOnly value={p.value + '\u200b'} rows={1}
      style={{...style, position: 'absolute', pointerEvents: 'none', opacity: 0, width: p.measurementWidth, height: 0, overflow: 'hidden'}}/>
    <textarea data-testid="ui-chat-input" aria-label="메시지" value={p.value} onChange={event => p.onChange(event.target.value)} onFocus={p.onFocus}
      placeholder="메시지 보내기…" rows={1} maxLength={p.metrics.maxLength}
      style={{...style, display: 'block', width: '100%', height: '100%', outlineOffset: 3, overflowY: p.scrollable ? 'auto' : 'hidden'}}/>
  </>;
}
