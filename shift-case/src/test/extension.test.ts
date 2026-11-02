import * as assert from 'assert';
import * as vscode from 'vscode';
import { toggleCase } from '../extension';

async function open(content: string) {
	await vscode.extensions.getExtension('bitbyandy.shift-case')?.activate();
	const document = await vscode.workspace.openTextDocument({ content, language: 'plaintext' });
	const editor = await vscode.window.showTextDocument(document);
	return { document, editor };
}

const toggle = () => vscode.commands.executeCommand('shift-case.toggleCase');
const at = (line: number, ch: number) => new vscode.Selection(line, ch, line, ch);
const selectedTexts = (editor: vscode.TextEditor) =>
	editor.selections.map(s => editor.document.getText(s));

suite('toggleCase', () => {
	const cases: Array<[string, string]> = [
		['hello world', 'HELLO WORLD'],
		['HELLO WORLD', 'hello world'],
		['Hello World', 'HELLO WORLD'],
		['Hello123!@#', 'HELLO123!@#'],
		['HELLO123!@#', 'hello123!@#'],
		['123', '123'],
		['', ''],
		['  hello  ', '  HELLO  '],
		['café', 'CAFÉ'],
		['CAFÉ', 'café'],
	];
	for (const [input, expected] of cases) {
		test(`"${input}" -> "${expected}"`, () => assert.strictEqual(toggleCase(input), expected));
	}
});

suite('shift-case.toggleCase command', () => {
	test('is registered', async () => {
		await vscode.extensions.getExtension('bitbyandy.shift-case')?.activate();
		assert.ok((await vscode.commands.getCommands(true)).includes('shift-case.toggleCase'));
	});

	test('toggles each non-empty selection', async () => {
		const { document, editor } = await open('hello world\nFOO BAR');
		editor.selections = [new vscode.Selection(0, 0, 0, 5), new vscode.Selection(1, 0, 1, 3)];
		await toggle();
		assert.strictEqual(document.getText(), 'HELLO world\nfoo BAR');
	});

	test('keeps a non-empty selection selected after toggling', async () => {
		const { editor } = await open('hello world');
		editor.selection = new vscode.Selection(0, 0, 0, 5);
		await toggle();
		assert.deepStrictEqual(selectedTexts(editor), ['HELLO']);
	});

	test('keeps a reversed selection reversed', async () => {
		const { editor } = await open('hello world');
		editor.selection = new vscode.Selection(0, 5, 0, 0);
		await toggle();
		assert.ok(editor.selection.isReversed);
		assert.deepStrictEqual(selectedTexts(editor), ['HELLO']);
	});

	suite('no selection (cursor in a word)', () => {
		test('toggles the word under the cursor and selects it', async () => {
			const { document, editor } = await open('hello world');
			editor.selection = at(0, 2);
			await toggle();
			assert.strictEqual(document.getText(), 'HELLO world');
			assert.deepStrictEqual(selectedTexts(editor), ['HELLO']);
			await toggle();
			assert.strictEqual(document.getText(), 'hello world');
		});

		test('works with the cursor at the edges of a word', async () => {
			const { document, editor } = await open('hello world');
			editor.selection = at(0, 0);
			await toggle();
			assert.strictEqual(document.getText(), 'HELLO world');
		});

		test('treats underscores as part of the word', async () => {
			const { document, editor } = await open('some_value other');
			editor.selection = at(0, 6);
			await toggle();
			assert.strictEqual(document.getText(), 'SOME_VALUE other');
		});

		test('does nothing when the cursor is not on a word', async () => {
			const { document, editor } = await open('hello   world');
			editor.selection = at(0, 7);
			await toggle();
			assert.strictEqual(document.getText(), 'hello   world');
		});

		test('does nothing in an empty document', async () => {
			const { document } = await open('');
			await toggle();
			assert.strictEqual(document.getText(), '');
		});
	});

	suite('multiple cursors', () => {
		test('toggles the word at each cursor', async () => {
			const { document, editor } = await open('one two\nTHREE four');
			editor.selections = [at(0, 1), at(1, 1)];
			await toggle();
			assert.strictEqual(document.getText(), 'ONE two\nthree four');
		});

		test('two cursors in the same word toggle it once', async () => {
			const { document, editor } = await open('hello world');
			editor.selections = [at(0, 1), at(0, 3)];
			await toggle();
			assert.strictEqual(document.getText(), 'HELLO world');
		});

		test('mixes selections and bare cursors', async () => {
			const { document, editor } = await open('abc def ghi');
			editor.selections = [new vscode.Selection(0, 0, 0, 3), at(0, 9)];
			await toggle();
			assert.strictEqual(document.getText(), 'ABC def GHI');
		});

		test('a cursor inside a selection overlapping its word is merged, not rejected', async () => {
			const { document, editor } = await open('hello world');
			editor.selections = [new vscode.Selection(0, 0, 0, 6), at(0, 2)];
			await toggle();
			assert.strictEqual(document.getText(), 'HELLO world');
			assert.deepStrictEqual(selectedTexts(editor), ['HELLO ']);
		});

		test('a cursor in a word partly covered by a selection is merged into the selection', async () => {
			const { document, editor } = await open('hello world');
			editor.selections = [new vscode.Selection(0, 3, 0, 8), at(0, 10)]; // "lo wo" + a cursor in "world"
			await toggle();
			assert.strictEqual(document.getText(), 'helLO WOrld');
			assert.deepStrictEqual(selectedTexts(editor), ['LO WO']);
		});

		test('keeps the primary selection first when it is later in the document', async () => {
			const { document, editor } = await open('one two three');
			editor.selections = [at(0, 9), at(0, 1)]; // primary cursor is in "three"
			await toggle();
			assert.strictEqual(document.getText(), 'ONE two THREE');
			assert.deepStrictEqual(selectedTexts(editor), ['THREE', 'ONE']);
		});

		test('keeps cursors that are not on a word, and keeps them in order', async () => {
			const { document, editor } = await open('hi   there');
			editor.selections = [at(0, 3), at(0, 7)]; // primary is on whitespace
			await toggle();
			assert.strictEqual(document.getText(), 'hi   THERE');
			assert.strictEqual(editor.selections.length, 2);
			assert.ok(editor.selections[0].isEmpty);
			assert.strictEqual(editor.selections[0].active.character, 3);
			assert.strictEqual(editor.selections[1].isEmpty, false);
			assert.strictEqual(document.getText(editor.selections[1]), 'THERE');
		});

		test('a single undo reverts every cursor', async () => {
			const { document, editor } = await open('one two\nthree four');
			editor.selections = [at(0, 1), at(1, 1)];
			await toggle();
			assert.strictEqual(document.getText(), 'ONE two\nTHREE four');
			await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
			await vscode.commands.executeCommand('undo');
			assert.strictEqual(document.getText(), 'one two\nthree four');
		});
	});

	suite('text that changes length', () => {
		test('selection covers the whole new text ("ß" -> "SS")', async () => {
			const { document, editor } = await open('straße x');
			editor.selection = new vscode.Selection(0, 0, 0, 6);
			await toggle();
			assert.strictEqual(document.getText(), 'STRASSE x');
			assert.deepStrictEqual(selectedTexts(editor), ['STRASSE']);
		});

		test('a cursor on whitespace after a growing edit is shifted with the text', async () => {
			const { document, editor } = await open('straße  x');
			editor.selections = [new vscode.Selection(0, 0, 0, 6), at(0, 7)];
			await toggle();
			assert.strictEqual(document.getText(), 'STRASSE  x');
			assert.strictEqual(editor.selections.length, 2);
			assert.deepStrictEqual(
				[editor.selections[1].active.line, editor.selections[1].active.character],
				[0, 8]
			);
		});

		test('later cursors stay on their text when an earlier edit grows', async () => {
			const { document, editor } = await open('straße abc');
			editor.selections = [new vscode.Selection(0, 0, 0, 6), at(0, 8)];
			await toggle();
			assert.strictEqual(document.getText(), 'STRASSE ABC');
			assert.deepStrictEqual(selectedTexts(editor), ['STRASSE', 'ABC']);
		});
	});
});
