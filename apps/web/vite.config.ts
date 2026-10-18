import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react()], base: './',
  resolve: { alias: Object.fromEntries(['domain','application','contracts','platform-ports','local-data','mocks','config','guidance-engine','privacy','pet-engine','ui','design-tokens','api-client','reminder-engine'].map(name => ['@nuanban/' + name, resolve(import.meta.dirname, '../../packages/' + name + '/src/index.ts')])) },
  server: { port: 5173, strictPort: true }, build: { target: 'es2022' },
});
