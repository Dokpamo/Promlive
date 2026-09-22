import type {ReactNode} from 'react';
import {Modal} from 'react-native';
import type {OverlayMeasure} from './ChatOverlay';

// The web modal portal already uses viewport coordinates.
const measure: OverlayMeasure = (target, done) => target.measureInWindow(done);
export function useChatOverlayMeasure() {return measure;}

export function ChatOverlayHost({children}: {children: ReactNode}) {return children;}

/** The web modal retains its focus trap and restores focus when it closes. */
export function ChatOverlay({children, onRequestClose}: {children: ReactNode; onRequestClose: () => void}) {
  return <Modal visible transparent animationType="none" onRequestClose={onRequestClose}>{children}</Modal>;
}
