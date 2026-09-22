import {useImperativeHandle, useLayoutEffect, useRef} from 'react';
import type {ComposerInputProps, ComposerSelection} from './ComposerInput.types';
import {useAppearance} from '../appearance/AppAppearance';

export function ComposerInput(p: ComposerInputProps) {
  const {colors: c} = useAppearance();
  const element = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(p.focusRef, () => {
    const setSelection = (next: ComposerSelection) => {
      const node = element.current;
      if (!node) return;
      const start = Math.max(0, Math.min(next.start, node.value.length));
      node.setSelectionRange(start, Math.max(start, Math.min(next.end, node.value.length)));
    };
    return {
      focus: next => {element.current?.focus({preventScroll: true}); if (next) setSelection(next);},
      focusForExpansion: onKeyboardStart => {element.current?.focus({preventScroll: true}); onKeyboardStart();},
      isFocused: () => element.current === document.activeElement,
      getSelection: () => ({start: element.current?.selectionStart ?? 0, end: element.current?.selectionEnd ?? 0}),
      setSelection,
    };
  }, []);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () => {
      const previous = node.style.height;
      const scrollTop = node.scrollTop;
      node.style.height = '0px';
      const height = node.scrollHeight;
      node.style.height = previous;
      node.scrollTop = scrollTop;
      p.onHeight(height);
    };
    measure();
    // Height changes every frame during the morph. Only a width change can
    // rewrap the text; repeatedly resetting height would disturb scrolling.
    let width = node.getBoundingClientRect().width;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? width;
      if (Math.abs(next - width) < 0.5) return;
      width = next;
      measure();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [p.value, p.fontSize, p.lineHeight, p.onHeight]);
  return <textarea ref={element} data-testid={p.testID ?? 'chat-input'} aria-label={p.label ?? '메시지 입력'} value={p.value} disabled={!p.ready} onChange={e => p.onChange(e.target.value)} onFocus={p.onFocus} placeholder="무엇이든 물어보세요." maxLength={8000} rows={1} style={{display: 'block', width: '100%', height: p.fillHeight ? '100%' : p.height, padding: 0, margin: 0, border: 0, outline: 'none', background: 'transparent', color: c.text, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', fontWeight: 400, fontSize: p.fontSize, lineHeight: `${p.lineHeight}px`, resize: 'none', overflowY: p.scroll ? 'auto' : 'hidden', scrollbarWidth: 'none'}}/>;
}
