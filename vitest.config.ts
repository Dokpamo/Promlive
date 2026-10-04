import {defineConfig} from 'vitest/config';
export default defineConfig({
  resolve: {alias: [{find: /^\.\.\/app\/createWorkspace$/, replacement: new URL('./src/app/createWorkspace.web.ts', import.meta.url).pathname}]},
  test: {include: ['tests/**/*.test.{ts,tsx}'], environment: 'node'},
});
