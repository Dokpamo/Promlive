import {composerScale} from './chatAppearance';
import {panelReference} from '../../layout/panelGeometry';

export interface ComposerFrame {x: number; y: number; width: number; height: number; radius: number}
interface Viewport {width: number; height: number}
interface Insets {top: number; right: number; bottom: number; left: number}

/** The sheet belongs to the full window; the keyboard never changes its bounds. */
export function expandedComposerFrame(viewport: Viewport, insets: Insets): ComposerFrame {
  const scale = composerScale(viewport.width);
  const inset = panelReference.sheetInset * scale;
  const bottom = Math.max(insets.bottom, inset);
  const width = Math.min(panelReference.contentMaxWidth, viewport.width - insets.left - insets.right - 2 * inset);
  const height = Math.max(0, Math.min(viewport.height * 0.9, viewport.height - insets.top - inset - bottom));
  return {x: insets.left + (viewport.width - insets.left - insets.right - width) / 2, y: viewport.height - bottom - height, width, height, radius: panelReference.radius * scale};
}

/** Only the editor's scroll viewport ends above the keyboard, inside the fixed sheet. */
export function composerEditorHeight(sheet: ComposerFrame, inputTop: number, contentHeight: number, line: number, bottomPadding: number, visibleBottom: number) {
  const available = Math.min(sheet.y + sheet.height, visibleBottom) - sheet.y - inputTop - bottomPadding;
  return Math.min(Math.max(line, contentHeight), Math.max(line, available));
}
