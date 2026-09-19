import {useLayoutEffect, useRef} from 'react';
import type {ComposerInputProps} from './ComposerInput.types';
import {useAppearance} from '../appearance/AppAppearance';

export function ComposerInput(p: ComposerInputProps) {
  const {colors: c} = useAppearance();
  const element = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () => {
      const previous = node.style.height;
      node.style.height = '0px';
      const height = node.scrollHeight;
      node.style.height = previous;
      p.onHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [p.value, p.fontSize, p.lineHeight, p.onHeight]);
  return <textarea ref={element} data-testid="chat-input" aria-label="메시지 입력" value={p.value} disabled={!p.ready} onChange={e => p.onChange(e.target.value)} onFocus={p.onFocus} placeholder="무엇이든 물어보세요." maxLength={8000} rows={1} style={{display: 'block', width: '100%', height: p.height, padding: 0, margin: 0, border: 0, outline: 'none', background: 'transparent', color: c.text, fontFamily: 'Arial, sans-serif', fontSize: p.fontSize, lineHeight: `${p.lineHeight}px`, resize: 'none', overflowY: p.scroll ? 'auto' : 'hidden', scrollbarWidth: 'none'}}/>;
}
