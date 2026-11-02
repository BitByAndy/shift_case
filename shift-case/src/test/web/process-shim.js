// Minimal `process` for browser-bundled Node polyfills (e.g. `assert`) that
// reference it when formatting assertion errors. Used by `node esbuild.js --web-tests`.
export const process = {
	env: {},
	argv: [],
	platform: 'browser',
	version: '',
	versions: {},
	stdout: { isTTY: false },
	stderr: { isTTY: false },
	cwd: () => '/',
	emitWarning: () => { },
	nextTick: (fn, ...args) => queueMicrotask(() => fn(...args)),
};
