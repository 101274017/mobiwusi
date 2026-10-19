import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, 'avatar-runtime'),
    emptyOutDir: true,
    lib: { entry: resolve(import.meta.dirname, 'xingyun-renderer.js'), formats: ['es'], fileName: () => 'xingyun-renderer.js' },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
