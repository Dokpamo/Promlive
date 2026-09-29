import type {ItemLayout, ListItem} from './itemListMotion';

export type GridRow<T extends ListItem> = {
  kind: 'grid'; key: string; items: T[]; top: number; height: number;
};
export type ManagedLayout<T extends ListItem> = ItemLayout<T> | GridRow<T>;

/** Keep pinned sections on separate, full-width rows, including partial rows. */
export function itemGridLayout<T extends ListItem>(items: readonly ItemLayout<T>[], columns: number, rowHeight: number): ManagedLayout<T>[] {
  const rows: ManagedLayout<T>[] = [];
  let pending: T[] = [], top = 0, index = 0;
  const flush = () => {
    if (!pending.length) return;
    rows.push({kind: 'grid', key: `grid:${index++}`, items: pending, top, height: rowHeight});
    top += rowHeight;
    pending = [];
  };
  for (const item of items) {
    if (item.kind === 'divider') {
      if (item.visible) flush();
      rows.push({...item, top});
      top += item.height;
    } else {
      pending.push(item.item);
      if (pending.length === columns) flush();
    }
  }
  flush();
  return rows;
}
