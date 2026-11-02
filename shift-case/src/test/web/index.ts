// Entry point for the web test run (@vscode/test-web). Bundled for the browser by
// `node esbuild.js --web-tests`; Mocha runs inside the web extension host worker.
import { registerCommandTests } from '../shared/commandTests';
import { registerNotebookTests } from '../shared/notebookTests';

// Mocha's browser build defines the global `mocha` instance.
require('mocha/mocha');

export function run(): Promise<void> {
	return new Promise((resolve, reject) => {
		// The default HTML reporter needs a DOM, which the extension host worker lacks,
		// so switch to the console-based spec reporter.
		mocha.setup({ ui: 'tdd' });
		mocha.reporter('spec');
		registerCommandTests();
		registerNotebookTests();
		try {
			mocha.run(failures => {
				if (failures > 0) {
					reject(new Error(`${failures} tests failed.`));
				} else {
					resolve();
				}
			});
		} catch (err) {
			reject(err);
		}
	});
}
