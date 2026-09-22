import type {Card} from './model';

function mergeChanges<T extends object>(base: T, current: T, saved: T): T {
  const merged = {...saved};
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (current[key] !== base[key]) merged[key] = current[key];
  }
  return merged;
}

/** Keep edits made after a write started, including edits within a template field. */
export function rebaseEditorChanges(base: Card, current: Card, saved: Card): Card {
  const merged = mergeChanges(base, current, saved);
  if (base.body.kind === 'template' && current.body.kind === 'template' && saved.body.kind === 'template') {
    merged.body = {...saved.body, data: mergeChanges(base.body.data, current.body.data, saved.body.data)};
  } else if (base.body.kind === 'code' && current.body.kind === 'code' && saved.body.kind === 'code') {
    merged.body = {...saved.body, source: mergeChanges(base.body.source, current.body.source, saved.body.source)};
  }
  return {...merged, id: saved.id, revision: saved.revision, createdAt: saved.createdAt, updatedAt: saved.updatedAt};
}
