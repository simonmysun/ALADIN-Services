import { build } from 'esbuild';
import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const staticSourceDir = resolve('src/static');
const staticTargetDir = resolve(distDir, 'static');

const sharedOptions = {
	bundle: true,
	format: 'cjs',
	minify: true,
	platform: 'node',
	target: 'node22',
};

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

await Promise.all([
	build({
		...sharedOptions,
		entryPoints: ['src/index.ts'],
		outfile: 'dist/index.js',
	}),
	build({
		...sharedOptions,
		entryPoints: ['src/cli.ts'],
		outfile: 'dist/cli.js',
	}),
]);

const cliEntry = resolve(distDir, 'cli.js');
const cliContent = await readFile(cliEntry, 'utf8');
if (!cliContent.startsWith('#!/usr/bin/env node')) {
	await writeFile(cliEntry, `#!/usr/bin/env node\n${cliContent}`, 'utf8');
}

await mkdir(staticTargetDir, { recursive: true });
await cp(staticSourceDir, staticTargetDir, { recursive: true });
await chmod(cliEntry, 0o755);
