import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    shims: true,
  },
  {
    // Loaded by Docusaurus as a client module, so it ships as ESM with its stylesheet beside it.
    entry: { 'client/index': 'src/client/index.ts' },
    format: ['esm'],
    sourcemap: true,
    target: 'es2020',
    external: ['./styles.css'],
    onSuccess: 'cp src/client/styles.css dist/client/styles.css',
  },
]);
