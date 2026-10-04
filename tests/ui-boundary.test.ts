import {readFileSync, existsSync} from 'node:fs';
import {dirname, resolve, sep} from 'node:path';
import ts from 'typescript';
import {expect, it} from 'vitest';

it('keeps the production entry disconnected from legacy screens while reusing data services', () => {
  const root = resolve(import.meta.dirname, '..');
  const uiRoot = resolve(root, 'src/ui') + sep;
  const visited = new Set<string>();
  const packages = new Set(['react', 'react-native', 'react-native-safe-area-context', '@op-engineering/op-sqlite', 'react-native-gesture-handler', 'react-native/src/private/animated/NativeAnimatedHelper', 'zod', '@noble/hashes/sha2.js', 'react-native-keychain', 'react-native-image-picker', '@react-native-community/image-editor', 'sql.js', 'sql.js/dist/sql-wasm.wasm?url']);
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function dependency(specifier: string) {
      if (!specifier.startsWith('.')) {
        expect(packages.has(specifier), `Unexpected package in new UI: ${specifier}`).toBe(true);
        return;
      }
      const base = resolve(dirname(file), specifier);
      if (/\.(json|jpg|png|webp)$/.test(base)) {expect(existsSync(base)).toBe(true); return;}
      const target = [base + '.ts', base + '.tsx', resolve(base, 'index.ts'), resolve(base, 'index.tsx')].find(existsSync);
      expect(target, `Missing dependency: ${file} → ${specifier}`).toBeDefined();
      const dataService = target!.endsWith('.ts') && ['src/features/', 'src/adapters/', 'src/ports/', 'src/extensions/', 'src/creator-sdk/', 'src/app/runtime.ts'].some(path => target!.startsWith(resolve(root, path)));
      expect(target!.startsWith(uiRoot) || dataService, `Legacy UI reconnected: ${file} → ${target}`).toBe(true);
      visit(target!);
      // Check native adapters too, rather than only the default desktop/web module.
      for (const platform of ['android', 'ios', 'native', 'web']) for (const extension of ['ts', 'tsx']) {
        const adapter = `${base}.${platform}.${extension}`;
        if (existsSync(adapter)) visit(adapter);
      }
    }
    function walk(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependency(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const path = node.arguments[0];
        expect(path && ts.isStringLiteral(path), 'Runtime dependency must be explicit').toBe(true);
        if (path && ts.isStringLiteral(path)) dependency(path.text);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  visit(resolve(root, 'App.tsx'));
  expect(visited.has(resolve(root, 'src/ui/App.tsx'))).toBe(true);
});
