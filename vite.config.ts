import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // React Native Web uses the native `global` name when interrupting an animation.
  define: {global: 'globalThis'},
  resolve: {alias: [{find: /^react-native$/, replacement: 'react-native-web'}], extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json']},
  optimizeDeps: {esbuildOptions: {resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json']}},
  server: {port: 5178, strictPort: true},
  build: {target: 'es2022'},
});
