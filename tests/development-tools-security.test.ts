import {expect, it} from 'vitest';
import {isFileLoadingAllowed, normalizePath, resolveConfig} from 'vite';
import {resolveApiServerConfig} from 'vitest/node';

it('blocks alternate data-stream paths for denied development files while allowing ordinary source files', async () => {
  const root = normalizePath(process.cwd());
  const config = await resolveConfig({configFile: false, envFile: false, root,
    server: {fs: {strict: true, allow: [root], deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**']}}}, 'serve');
  for (const file of ['.env', '.env.local', 'tls.pem', '.env::$DATA', 'tls.pem::$DATA', '.env::$DATA/']) {
    expect(isFileLoadingAllowed(config, `${root}/${file}`), file).toBe(false);
  }
  expect(isFileLoadingAllowed(config, `${root}/src/ordinary.ts`)).toBe(true);
});

it('disables Vitest API write and execution on exposed hosts without breaking local interactive defaults', () => {
  for (const host of ['0.0.0.0', '::', '192.0.2.1']) {
    expect(resolveApiServerConfig({api: {host}}, 51204)).toMatchObject({allowWrite: false, allowExec: false});
  }
  for (const host of ['localhost', '127.0.0.1']) {
    expect(resolveApiServerConfig({api: {host}}, 51204)).toMatchObject({allowWrite: true, allowExec: true});
  }
});
