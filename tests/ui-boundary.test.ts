import {resolve, sep} from 'node:path';
import {expect, it} from 'vitest';
import {sourceGraph, sourcePlatforms} from './source-graph';

it.each(sourcePlatforms)('keeps %s production screens separate from legacy UI while using data services', platform => {
  const root = resolve(import.meta.dirname, '..'), uiRoot = resolve(root, 'src/ui') + sep;
  const graph = sourceGraph([platform === 'web' ? 'web/main.tsx' : 'index.js'], platform);
  const packages = new Set(['react', 'react/jsx-runtime', 'react-dom/client', 'react-native', 'react-native-safe-area-context', '@op-engineering/op-sqlite',
    'react-native-gesture-handler', 'react-native/src/private/animated/NativeAnimatedHelper', 'zod', '@noble/hashes/sha2.js',
    'react-native-keychain', 'react-native-image-picker', '@react-native-community/image-editor', 'sql.js', 'sql.js/dist/sql-wasm.wasm?url']);
  for (const dependency of graph.packages) expect(packages.has(dependency), dependency).toBe(true);
  for (const file of graph.visited) {
    if (!file.startsWith(resolve(root, 'src') + sep) || !/\.[jt]sx?$/.test(file)) continue;
    const service = file.endsWith('.ts') && ['features', 'adapters', 'ports', 'extensions', 'creator-sdk', 'app'].some(dir => file.startsWith(resolve(root, 'src', dir) + sep));
    expect(file.startsWith(uiRoot) || service, `Legacy UI reconnected: ${file}`).toBe(true);
  }
  const dataEntries = [...graph.visited].filter(file => file.startsWith(resolve(root, 'src') + sep) && !file.startsWith(uiRoot) && file.endsWith('.ts'));
  const dataGraph = sourceGraph(dataEntries, platform);
  expect([...dataGraph.visited].filter(file => file.startsWith(uiRoot)), 'Data/storage imports a screen implementation').toEqual([]);
  expect(graph.visited.has(resolve(root, 'src/ui/App.tsx'))).toBe(true);
  expect(graph.visited.has(resolve(root, 'src/app/runtime.ts'))).toBe(true);
  if (platform === 'windows') expect(graph.visited.has(resolve(root, 'src/app/createWorkspace.windows.ts'))).toBe(true);
});
