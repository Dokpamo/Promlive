import type {ReactNode, RefObject} from 'react';

/** The browser can still emit a click after a pan cancels the press responder. */
export function DragClickBoundary({children, cancelClick}: {children: ReactNode; cancelClick: RefObject<boolean>}) {
  return <div style={{display: 'contents'}} onClickCapture={event => {
    if (cancelClick.current && event.detail > 0) {
      event.preventDefault();
      event.stopPropagation();
      cancelClick.current = false;
    }
  }}>{children}</div>;
}
