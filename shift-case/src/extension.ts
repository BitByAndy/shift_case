import * as vscode from 'vscode';

/**
 * Toggles text between UPPERCASE and lowercase:
 * all-uppercase text becomes lowercase, anything else becomes UPPERCASE.
 */
export function toggleCase(text: string): string {
	return text === text.toUpperCase() ? text.toLowerCase() : text.toUpperCase();
}

interface Target {
	range: vscode.Range;
	reversed: boolean;
}

/**
 * Resolves what each selection should act on. A non-empty selection acts on
 * itself; an empty one (a bare cursor) acts on the word under the cursor, using
 * the language's own word definition. Cursors that are not on a word are skipped,
 * and cursors landing in the same word are merged so edits never overlap.
 */
function resolveTargets(editor: vscode.TextEditor): Target[] {
	const { document } = editor;
	const seen = new Set<string>();
	const targets: Target[] = [];

	for (const selection of editor.selections) {
		const range = selection.isEmpty
			? document.getWordRangeAtPosition(selection.active)
			: selection;
		if (!range || range.isEmpty) {
			continue;
		}
		const key = `${document.offsetAt(range.start)}:${document.offsetAt(range.end)}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		targets.push({ range, reversed: selection.isReversed });
	}
	return targets.sort((a, b) => a.range.start.compareTo(b.range.start));
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('shift-case.toggleCase', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const { document } = editor;
		const targets = resolveTargets(editor);
		if (targets.length === 0) {
			return;
		}

		// Compute everything against the pre-edit document, then map the new
		// selections through the length changes (e.g. "ß" -> "SS").
		const edits = targets.map(({ range }) => {
			const oldText = document.getText(range);
			return {
				range,
				text: toggleCase(oldText),
				oldLength: oldText.length,
				start: document.offsetAt(range.start),
			};
		});

		// A single editor.edit call is one undo step for every cursor.
		const applied = await editor.edit(editBuilder => {
			for (const { range, text } of edits) {
				editBuilder.replace(range, text);
			}
		});
		if (!applied) {
			return;
		}

		let delta = 0;
		editor.selections = edits.map(({ text, oldLength, start }, i) => {
			const newStart = start + delta;
			delta += text.length - oldLength;
			const a = document.positionAt(newStart);
			const b = document.positionAt(newStart + text.length);
			return targets[i].reversed ? new vscode.Selection(b, a) : new vscode.Selection(a, b);
		});
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
