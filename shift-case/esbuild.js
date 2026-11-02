const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const webTests = process.argv.includes('--web-tests');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/** @type {import('esbuild').BuildOptions} */
const common = {
	entryPoints: [
		'src/extension.ts'
	],
	bundle: true,
	format: 'cjs',
	minify: production,
	sourcemap: !production,
	sourcesContent: false,
	external: ['vscode'],
	logLevel: 'silent',
	plugins: [
		/* add to the end of plugins array */
		esbuildProblemMatcherPlugin,
	],
};

async function main() {
	// Desktop (Node) bundle and web (browser / vscode.dev) bundle.
	const targets = [
		{ ...common, platform: 'node', outfile: 'dist/extension.js' },
		{ ...common, platform: 'browser', outfile: 'dist/web/extension.js' },
	];
	if (webTests) {
		// Mocha test bundle that runs inside the web extension host (@vscode/test-web).
		targets.push({
			...common,
			entryPoints: ['src/test/web/index.ts'],
			platform: 'browser',
			outfile: 'dist/test/web/index.js',
			minify: false,
			inject: ['src/test/web/process-shim.js'],
			define: { global: 'globalThis' },
		});
	}
	const contexts = await Promise.all(targets.map(t => esbuild.context(t)));
	if (watch) {
		await Promise.all(contexts.map(ctx => ctx.watch()));
	} else {
		await Promise.all(contexts.map(ctx => ctx.rebuild()));
		await Promise.all(contexts.map(ctx => ctx.dispose()));
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
