// vitest.config.ts
import {
	defineConfig,
	coverageConfigDefaults,
	configDefaults,
} from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		reporters: ['verbose', 'junit'],
		outputFile: {
			junit: './test/results/junit-report.xml',
		},
		exclude: [...configDefaults.exclude, './demo/*', './examples/*'],
		coverage: {
			reporter: ['text', 'html'],
			reportsDirectory: './test/coverage',
			exclude: [
				...coverageConfigDefaults.exclude,
				'**/testutils/**',
				'./demo/*',
				'./examples/*',
			],
		},
		testTimeout: 30000,
		hookTimeout: 30000,
	},
});
