import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/three-way-merge/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      'three-way-diff-editor': path.resolve(__dirname, '../packages/core/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
