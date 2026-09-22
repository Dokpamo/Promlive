import {createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';

export type OverlayMeasure = (target: View, done: (x: number, y: number, width: number, height: number) => void) => void;
const OverlayContent = createContext<{setContent: (content: ReactNode) => void; measure: OverlayMeasure} | null>(null);

/** Keep the expanded editor in the chat's native window so focus never restarts the IME. */
export function ChatOverlayHost({children}: {children: ReactNode}) {
  const [content, setContent] = useState<ReactNode>(null);
  const host = useRef<View>(null);
  const measure = useCallback<OverlayMeasure>((target, done) => {
    // Android's measureInWindow excludes the status bar. Both views must be
    // measured in the same window, then converted into the overlay's space.
    host.current?.measureInWindow((hostX, hostY) => {
      target.measureInWindow((x, y, width, height) => done(x - hostX, y - hostY, width, height));
    });
  }, []);
  const context = useMemo(() => ({setContent, measure}), [measure]);
  const active = content != null;
  return <OverlayContent.Provider value={context}>
    <View ref={host} collapsable={false} testID="chat-overlay-host" style={{flex: 1}}>
      <View collapsable={false} style={{flex: 1}} pointerEvents={active ? 'none' : 'auto'} aria-hidden={active} accessibilityElementsHidden={active} importantForAccessibility={active ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {active && <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>{content}</View>}
    </View>
  </OverlayContent.Provider>;
}

export function ChatOverlay({children}: {children: ReactNode; onRequestClose: () => void}) {
  const context = useContext(OverlayContent);
  if (!context) throw new Error('ChatOverlay needs a ChatOverlayHost');
  const {setContent} = context;
  useLayoutEffect(() => {setContent(children);}, [children, setContent]);
  useLayoutEffect(() => () => setContent(null), [setContent]);
  return null;
}

export function useChatOverlayMeasure() {
  const context = useContext(OverlayContent);
  if (!context) throw new Error('useChatOverlayMeasure needs a ChatOverlayHost');
  return context.measure;
}
