import {createContext, useContext, useLayoutEffect, useRef, type RefObject} from 'react';
import {View, type GestureResponderEvent, type ViewProps} from 'react-native';

type PressListener = (event: GestureResponderEvent) => void;
const Context = createContext<Set<PressListener> | null>(null);

/** Observe clicks across panes without taking the responder from the clicked control. */
export function DesktopSearchDismissal(props: ViewProps) {
  const listeners = useRef(new Set<PressListener>()).current;
  return <Context.Provider value={listeners}><View {...props} onStartShouldSetResponderCapture={event => {
    for (const listener of listeners) listener(event);
    return false;
  }}/></Context.Provider>;
}

export function useDesktopSearchDismissal(boundary: RefObject<View | null>, enabled: boolean, onOutside: () => void) {
  const listeners = useContext(Context), latest = useRef(onOutside);
  latest.current = onOutside;
  useLayoutEffect(() => {
    if (!listeners || !enabled) return;
    let cancelled = false;
    const listener: PressListener = event => {
      const {pageX, pageY} = event.nativeEvent;
      // measure() and responder page coordinates both use the React root, including on macOS.
      boundary.current?.measure((_x, _y, width, height, left, top) => {
        if (cancelled || width <= 0 || height <= 0) return;
        if (pageX < left || pageX > left + width || pageY < top || pageY > top + height) latest.current();
      });
    };
    listeners.add(listener);
    return () => {cancelled = true; listeners.delete(listener);};
  }, [boundary, enabled, listeners]);
}
