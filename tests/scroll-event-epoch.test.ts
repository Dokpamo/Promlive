import {describe, expect, it} from 'vitest';
import {ScrollEventEpoch} from '../src/ui/workspace/ScrollEventEpoch';

describe('native scroll coordinate corrections', () => {
  it('rejects queued offsets from before a prepend, then accepts current scrolling', () => {
    const epoch = new ScrollEventEpoch();
    expect(epoch.accepts(100, 1000)).toBe(true);
    epoch.correct(1030);
    expect(epoch.accepts(120, 1045)).toBe(false);
    expect(epoch.accepts(140, 1046)).toBe(true);
    expect(epoch.accepts(160, 1064)).toBe(true);
  });
  it('recalibrates after sleep without blocking the next gesture', () => {
    const epoch = new ScrollEventEpoch();
    epoch.accepts(100, 1000);
    epoch.correct(1002);
    expect(epoch.accepts(150, 50000)).toBe(true);
    epoch.correct(50010);
    expect(epoch.accepts(155, 50015)).toBe(false);
    expect(epoch.accepts(170, 50020)).toBe(true);
  });
  it('preserves events on renderers without native timestamps', () => {
    const epoch = new ScrollEventEpoch();
    epoch.correct(1000);
    expect(epoch.accepts(undefined, 1001)).toBe(true);
    expect(epoch.accepts(0, 1001)).toBe(true);
  });
});
