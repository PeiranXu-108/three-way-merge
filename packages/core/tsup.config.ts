import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2020',
  // The editor uses hooks and the DOM: mark the bundle as a client component for React Server Components.
  banner: { js: '"use client";' },
});
