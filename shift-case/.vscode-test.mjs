import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	// The first test waits for the extension to activate, which can exceed the
	// 2s default on a cold Windows runner.
	mocha: { timeout: 10000 },
});
