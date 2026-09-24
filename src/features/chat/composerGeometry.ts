export interface ComposerFrame {x: number; y: number; width: number; height: number; radius: number}
interface Viewport {width: number; height: number}

/** The editor fills the window. Safe areas belong to its controls, not the surface. */
export function expandedComposerFrame(viewport: Viewport): ComposerFrame {
  return {x: 0, y: 0, width: viewport.width, height: viewport.height, radius: 0};
}

/** The insets scroll with the text; the viewport reaches behind both floating controls. */
export function composerEditorHeight(sheet: ComposerFrame, inputTop: number, contentHeight: number, line: number, bottomPadding: number, visibleBottom: number) {
  const available = Math.min(sheet.y + sheet.height, visibleBottom) - sheet.y;
  return Math.min(Math.max(line, contentHeight) + inputTop + bottomPadding, Math.max(line, available));
}
