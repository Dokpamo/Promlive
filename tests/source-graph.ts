import {existsSync, readFileSync, readdirSync, realpathSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import {basename, dirname, extname, resolve} from 'node:path';
import ts from 'typescript';
import {resolve as metroResolve, type ResolutionContext} from 'metro-resolver';
import viteConfig from '../vite.config';

export const sourcePlatforms = ['android', 'ios', 'macos', 'windows', 'web'] as const;
const root = resolve(import.meta.dirname, '..');
const metro = createRequire(import.meta.url)('../metro.config.js').resolver;
// Metro's file map is case-sensitive even on a case-insensitive macOS volume.
const existsExact = (path: string) => existsSync(path) && readdirSync(dirname(path)).includes(basename(path));
const isFile = (path: string) => existsExact(path) && statSync(path).isFile();

/** Production roots only. Includes type edges conservatively; tests are separate roots. */
export function sourceGraph(entries: string[], platform: typeof sourcePlatforms[number]) {
  const visited = new Set<string>(), packages = new Set<string>();
  function dependency(from: string, specifier: string) {
    if (!specifier.startsWith('.')) {packages.add(specifier); return;}
    if (platform === 'web') {
      const base = resolve(dirname(from), specifier), extensions = viteConfig.resolve!.extensions!;
      const target = [base, ...extensions.map(ext => base + ext), ...extensions.map(ext => resolve(base, 'index' + ext))].find(isFile);
      if (!target) throw new Error(`Missing web dependency: ${from} → ${specifier}`);
      visit(target); return;
    }
    const context: ResolutionContext = {
      originModulePath: from, dev: false, allowHaste: false, customResolverOptions: {}, disableHierarchicalLookup: false,
      assetExts: new Set(metro.assetExts), sourceExts: metro.sourceExts, mainFields: metro.resolverMainFields,
      nodeModulesPaths: [], extraNodeModules: {}, preferNativePlatform: true, doesFileExist: isFile,
      fileSystemLookup: path => !existsExact(path) ? {exists: false} : {exists: true, type: statSync(path).isDirectory() ? 'd' : 'f', realPath: realpathSync(path)},
      getPackage: path => isFile(path) ? JSON.parse(readFileSync(path, 'utf8')) : null,
      getPackageForModule: path => ({rootPath: root, packageJson: {}, packageRelativePath: path.slice(root.length + 1)}),
      resolveAsset: (dir, name, extension) => {const path = resolve(dir, name + extension); return isFile(path) ? [path] : null;},
      redirectModulePath: path => path, resolveHasteModule: () => null, resolveHastePackage: () => null,
      unstable_conditionNames: metro.unstable_conditionNames, unstable_conditionsByPlatform: metro.unstable_conditionsByPlatform,
      unstable_enablePackageExports: metro.unstable_enablePackageExports, unstable_incrementalResolution: false,
      unstable_logWarning: warning => {throw new Error(warning);}, resolveRequest: metro.resolveRequest,
    };
    const target = metroResolve(context, specifier, platform);
    if (target.type === 'sourceFile') visit(target.filePath);
    else if (target.type === 'assetFiles') target.filePaths.forEach(file => visited.add(file));
  }
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    if (!/\.[cm]?[jt]sx?$/.test(extname(file))) return;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function walk(node: ts.Node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependency(file, node.moduleSpecifier.text);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) dependency(file, node.argument.literal.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const argument = node.arguments[0];
        if (!argument || !ts.isStringLiteral(argument)) throw new Error(`Nonliteral dependency in ${file}`);
        dependency(file, argument.text);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  entries.forEach(entry => visit(resolve(root, entry)));
  return {visited, packages};
}
