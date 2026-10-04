import {defineConfig, mergeConfig} from 'vite';
import base from '../../../vite.config';
export default mergeConfig(base, defineConfig({root: import.meta.dirname, server: {port: 8786, strictPort: true},
  build: {outDir: '/tmp/promlive-performance-web', emptyOutDir: true}, preview: {port: 8786, strictPort: true}}));
