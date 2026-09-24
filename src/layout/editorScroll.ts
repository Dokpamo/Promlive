/** A one-time reading position handed between two editors of the same text. */
export interface EditorScrollRestore {offset: number; revision: number; revealCaret: boolean}

export function clampEditorScroll(offset: number, maxOffset: number) {
  return Math.max(0, Math.min(offset, Math.max(0, maxOffset)));
}
