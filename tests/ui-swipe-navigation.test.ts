import {expect, it} from 'vitest';
import {initialScreenView, type ScreenView} from '../src/ui/screenState';
import {rootPageKey, stepRootView, swipeDestination} from '../src/ui/swipeNavigation';

it('walks through filters before crossing into the next tab, including tabs without filters', () => {
  let view = initialScreenView();
  const visited = [rootPageKey(view)];
  for (let step = 0; step < 9; step++) {view = stepRootView(view, 1); visited.push(rootPageKey(view));}
  expect(visited).toEqual(['library:all', 'library:recent', 'library:idle', 'chats',
    'create:all', 'create:draft', 'create:ready', 'create:mine', 'create:external', 'settings']);
  expect(stepRootView(view, 1)).toBe(view);
  const backwards = [];
  for (let step = 0; step < 9; step++) {view = stepRootView(view, -1); backwards.push(rootPageKey(view));}
  expect(backwards).toEqual(['create:external', 'create:mine', 'create:ready', 'create:draft', 'create:all',
    'chats', 'library:idle', 'library:recent', 'library:all']);
  expect(stepRootView(view, -1)).toBe(view);
});

it('restores the selected filter and search when crossing tabs', () => {
  const view: ScreenView = {...initialScreenView(), tab: 'chats', libraryFilter: 'recent', creationFilter: 'mine'};
  const previous = stepRootView(view, -1), next = stepRootView(view, 1);
  expect(rootPageKey(previous)).toBe('library:recent');
  expect(rootPageKey(next)).toBe('create:mine');
  expect(previous.searches).toBe(view.searches);
  expect(next.searches).toBe(view.searches);
});

it('commits long swipes and deliberate flicks, cancels short drags and reversals', () => {
  expect(swipeDestination(-160, -100, 412, true, true)).toBe(1);
  expect(swipeDestination(160, 100, 412, true, true)).toBe(-1);
  expect(swipeDestination(-45, -800, 412, true, true)).toBe(1);
  expect(swipeDestination(45, 800, 412, true, true)).toBe(-1);
  expect(swipeDestination(-60, -100, 412, true, true)).toBeNull();
  expect(swipeDestination(-8, -2000, 412, true, true)).toBeNull();
  expect(swipeDestination(-160, 400, 412, true, true)).toBeNull();
});

it('does not wrap boundaries or allow a left swipe to navigate back', () => {
  expect(swipeDestination(200, 900, 412, false, true)).toBeNull();
  expect(swipeDestination(-200, -900, 412, true, false)).toBeNull();
  expect(swipeDestination(200, 900, 412, true, false)).toBe(-1);
  expect(swipeDestination(200, 900, 0, true, true)).toBeNull();
});
