import type {ReactNode, RefObject} from 'react';

/** Native press responders already cancel a press when a gesture takes over. */
export function DragClickBoundary({children}: {children: ReactNode; cancelClick: RefObject<boolean>}) {
  return children;
}
