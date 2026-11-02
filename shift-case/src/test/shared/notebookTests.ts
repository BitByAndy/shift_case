import * as assert from 'assert';
import * as vscode from 'vscode';
import { at, selectedTexts, toggle } from './commandTests';

/**
 * Opens an untitled Jupyter notebook with one code cell per entry in `cells`
 * and focuses the first cell's text editor (cell editors are ordinary text editors).
 */
async function openNotebook(...cells: string[]) {
	await vscode.extensions.getExtension('bitbyandy.shift-case')?.activate();
	const data = new vscode.NotebookData(
		cells.map(text => new vscode.NotebookCellData(vscode.NotebookCellKind.Code, text, 'python'))
	);
	const notebook = await vscode.workspace.openNotebookDocument('jupyter-notebook', data);
	await vscode.window.showNotebookDocument(notebook);
	return notebook;
}

/**
 * Puts the cell at `index` into edit mode and waits until its text editor is the
 * active text editor, as it is after a user clicks into the cell.
 */
async function focusCell(notebook: vscode.NotebookDocument, index: number) {
	const cellUri = notebook.cellAt(index).document.uri.toString();
	await vscode.window.showNotebookDocument(notebook, {
		selections: [new vscode.NotebookRange(index, index + 1)],
	});
	await vscode.commands.executeCommand('notebook.cell.edit');

	const deadline = Date.now() + 5000;
	while (Date.now() < deadline) {
		const active = vscode.window.activeTextEditor;
		if (active && active.document.uri.toString() === cellUri) {
			return active;
		}
		await new Promise(resolve => setTimeout(resolve, 50));
	}
	assert.fail(`cell ${index} editor never became the active text editor`);
}

/** Registers the Mocha suite for notebook cells. */
export function registerNotebookTests(): void {
	suite('shift-case.toggleCase in notebook cells', () => {
		test('toggles a selection inside a cell', async () => {
			const notebook = await openNotebook('hello notebook');
			const editor = await focusCell(notebook, 0);
			editor.selection = new vscode.Selection(0, 0, 0, 14);
			await toggle();
			assert.strictEqual(notebook.cellAt(0).document.getText(), 'HELLO NOTEBOOK');
			assert.deepStrictEqual(selectedTexts(editor), ['HELLO NOTEBOOK']);
		});

		test('toggles the word under a bare cursor and selects it', async () => {
			const notebook = await openNotebook('hello notebook');
			const editor = await focusCell(notebook, 0);
			editor.selection = at(0, 2);
			await toggle();
			assert.strictEqual(notebook.cellAt(0).document.getText(), 'HELLO notebook');
			assert.deepStrictEqual(selectedTexts(editor), ['HELLO']);
		});

		test('only changes the focused cell', async () => {
			const notebook = await openNotebook('first cell', 'second cell');
			const editor = await focusCell(notebook, 1);
			editor.selection = at(0, 1);
			await toggle();
			assert.strictEqual(notebook.cellAt(0).document.getText(), 'first cell');
			assert.strictEqual(notebook.cellAt(1).document.getText(), 'SECOND cell');
		});

		test('toggles multiple cursors within a cell', async () => {
			const notebook = await openNotebook('one two three');
			const editor = await focusCell(notebook, 0);
			editor.selections = [at(0, 1), at(0, 10)];
			await toggle();
			assert.strictEqual(notebook.cellAt(0).document.getText(), 'ONE two THREE');
		});
	});
}
