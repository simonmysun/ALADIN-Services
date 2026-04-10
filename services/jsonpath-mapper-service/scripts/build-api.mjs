#!/usr/bin/env node
import { build } from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: true,
};

await Promise.all([
  // API server bundle
  build({
    ...shared,
    entryPoints: ['src/api/index.ts'],
    outfile: 'dist/api.cjs',
    // Shim import.meta.url → pathToFileURL(__filename) so that packages like
    // @fastify/swagger-ui can resolve __dirname for their static assets.
    inject: ['./import-meta-url.js'],
    define: { 'import.meta.url': 'import_meta_url' },
  }),
  // CLI bundle
  build({
    ...shared,
    entryPoints: ['src/cli.ts'],
    outfile: 'dist/cli.cjs',
  }),
]);
