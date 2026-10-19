import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: Object.fromEntries(['domain', 'application', 'contracts', 'local-data', 'pet-engine', 'reminder-engine'].map(name => ['@nuanban/' + name, resolve(import.meta.dirname, '../../packages/' + name + '/src/index.ts')])) },
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, '../desktop/library-runtime'),
    emptyOutDir: true,
    lib: { entry: resolve(import.meta.dirname, 'src/pet-library.ts'), formats: ['es'], fileName: () => 'pet-library.js' },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
