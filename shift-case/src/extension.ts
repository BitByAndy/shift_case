import * as vscode from 'vscode';

/**
 * Toggles text between UPPERCASE and lowercase:
 * all-uppercase text becomes lowercase, anything else becomes UPPERCASE.
 */
export function toggleCase(text: string): string {
	return text === text.toUpperCase() ? text.toLowerCase() : text.toUpperCase();
}

/** A range to toggle, plus where it came from in `editor.selections`. */
interface Target {
	range: vscode.Range;
	reversed: boolean;
	/** Lowest index in `editor.selections` of the selections merged into this target. */
	index: number;
}

/** A bare cursor that is not on a word: left alone, but kept (and shifted) afterwards. */
interface Passthrough {
	/** Offset in the pre-edit document. */
	offset: number;
	index: number;
}

function overlaps(a: vscode.Range, b: vscode.Range): boolean {
	const intersection = a.intersection(b);
	return intersection !== undefined && !intersection.isEmpty;
}

/**
 * Resolves what each selection should act on. A non-empty selection acts on
 * itself; a bare cursor acts on the word under it, using the language's own word
 * definition. Edits must not overlap, so a cursor whose word overlaps a selection
 * (or another cursor's word) is merged into that target, and cursors that are not
 * on a word are passed through unchanged.
 */
function resolveTargets(editor: vscode.TextEditor): { targets: Target[]; passthrough: Passthrough[] } {
	const { document, selections } = editor;
	const targets: Target[] = [];
	const passthrough: Passthrough[] = [];

	// Explicit selections win over words derived from bare cursors.
	selections.forEach((selection, index) => {
		if (!selection.isEmpty) {
			targets.push({ range: selection, reversed: selection.isReversed, index });
		}
	});

	selections.forEach((selection, index) => {
		if (!selection.isEmpty) {
			return;
		}
		const word = document.getWordRangeAtPosition(selection.active);
		if (!word || word.isEmpty) {
			passthrough.push({ offset: document.offsetAt(selection.active), index });
			return;
		}
		const existing = targets.find(target => overlaps(target.range, word));
		if (existing) {
			existing.index = Math.min(existing.index, index);
		} else {
			targets.push({ range: word, reversed: false, index });
		}
	});

	targets.sort((a, b) => a.range.start.compareTo(b.range.start));
	return { targets, passthrough };
}

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('shift-case.toggleCase', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const { document } = editor;
		const { targets, passthrough } = resolveTargets(editor);
		if (targets.length === 0) {
			return;
		}

		// Compute everything against the pre-edit document, then map selections
		// through the length changes (e.g. "ß" -> "SS").
		const edits = targets.map(target => {
			const oldText = document.getText(target.range);
			return {
				target,
				range: target.range,
				text: toggleCase(oldText),
				delta: 0,
				start: document.offsetAt(target.range.start),
				end: document.offsetAt(target.range.end),
			};
		});
		for (const edit of edits) {
			edit.delta = edit.text.length - (edit.end - edit.start);
		}

		// A single editor.edit call is one undo step for every cursor.
		const applied = await editor.edit(editBuilder => {
			for (const { range, text } of edits) {
				editBuilder.replace(range, text);
			}
		});
		if (!applied) {
			return;
		}

		const result: Array<{ index: number; selection: vscode.Selection }> = [];

		let shift = 0;
		for (const { target, text, start, delta } of edits) {
			const a = document.positionAt(start + shift);
			const b = document.positionAt(start + shift + text.length);
			result.push({
				index: target.index,
				selection: target.reversed ? new vscode.Selection(b, a) : new vscode.Selection(a, b),
			});
			shift += delta;
		}

		for (const { offset, index } of passthrough) {
			// Shift by every edit that ended at or before this cursor.
			const moved = edits.reduce((sum, edit) => (edit.end <= offset ? sum + edit.delta : sum), offset);
			const position = document.positionAt(moved);
			result.push({ index, selection: new vscode.Selection(position, position) });
		}

		// Keep the user's selection order: `selections[0]` is the primary selection.
		result.sort((a, b) => a.index - b.index);
		editor.selections = result.map(r => r.selection);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
