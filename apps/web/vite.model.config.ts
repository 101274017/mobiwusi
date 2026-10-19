import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, '../desktop/model-runtime'),
    emptyOutDir: true,
    lib: { entry: resolve(import.meta.dirname, 'src/three-d/desktop.ts'), formats: ['es'], fileName: () => 'model-renderer.js' },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
