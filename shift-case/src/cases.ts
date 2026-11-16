// Pure text converters, kept free of the `vscode` API so they are trivial to test.

/**
 * A word is a run of lowercase (optionally capitalised), a run of capitals that is
 * not the start of a capitalised word ("HTTPServer" -> "HTTP", "Server"), digits,
 * or any other letters (scripts without case).
 */
const WORD = /\p{Lu}?\p{Ll}+|\p{Lu}+(?!\p{Ll})|\p{N}+|\p{L}+/gu;

/** Splits identifier-ish text into words, ignoring separators (spaces, `_`, `-`, punctuation). */
export function splitWords(text: string): string[] {
	return text.match(WORD) ?? [];
}

/**
 * Applies `convert` to the words of each line, keeping line breaks and each
 * line's leading and trailing whitespace, so a multi-line selection stays
 * multi-line.
 */
function perLine(text: string, convert: (words: string[]) => string): string {
	return text
		.split(/(\r\n|\n|\r)/)
		.map((part, i) => {
			if (i % 2 === 1) {
				return part; // the line break itself
			}
			const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(part)!;
			const words = splitWords(body);
			return words.length === 0 ? part : lead + convert(words) + trail;
		})
		.join('');
}

export function snakeCase(text: string): string {
	return perLine(text, words => words.map(w => w.toLowerCase()).join('_'));
}

const capitalize = (word: string) => {
	const [first = '', ...rest] = Array.from(word.toLowerCase());
	return first.toUpperCase() + rest.join('');
};

export function pascalCase(text: string): string {
	return perLine(text, words => words.map(capitalize).join(''));
}

/**
 * Lowercases everything, then capitalises the first letter of the text and the
 * first letter after each sentence end (`.`, `!`, `?` followed by whitespace).
 * Punctuation and spacing are left alone.
 */
export function sentenceCase(text: string): string {
	return text
		.toLowerCase()
		.replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}
