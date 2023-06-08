import { Token } from "./Token";

/**
 * @TODO This regex misses the range [\u10000-\uEFFFF], which should be a 32bit identifier
 * but it seems not supported by js regexes
 */
const NAME_START_CHAR_REGEX =
	/:|_|[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
const NAME_CHAR_REGEX = new RegExp(
	`${NAME_START_CHAR_REGEX.source}|-|\.|[0-9\xB7\u0300-\u036F\u203F-\u2040]`,
);
const NAME_REGEX = new RegExp(`${NAME_START_CHAR_REGEX.source}(${NAME_CHAR_REGEX.source})*`);

function createTextSlidingWindow(content: string, startingIndex: number) {
	let cursor: number = startingIndex;
	let lastPeekCursor = -1;

	return {
		get char() {
			return content[cursor];
		},
		get nextChar() {
			return content[cursor + 1];
		},
		get cursor() {
			return cursor;
		},
		get content() {
			return content;
		},
		peek(data: string): boolean {
			lastPeekCursor = -1;
			let nextIndex: number = 0;

			do {
				if (data[nextIndex] !== content[cursor + nextIndex]) {
					lastPeekCursor = -1;
					return false;
				}
			} while (++nextIndex < startingIndex + data.length);

			lastPeekCursor = cursor + nextIndex;
			return true;
		},
		advance() {
			if (lastPeekCursor > -1) {
				cursor = lastPeekCursor;
				lastPeekCursor = -1;

				return;
			}

			cursor++;
		},
		getPeekPosition() {
			return lastPeekCursor;
		},
	};
}

enum TokenizerState {
	UNKNOWN_CONTENT /** Starting point... */,
	// UNRECOGNIZED_CONTENT /** ...but we didn't recognize what are we reading */,
	HTML_CHARACTER_REFERENCE_ANNOTATION /** A sequence that starts with "&" */,

	/**
	 * All the contents, to be valid, must start with "<".
	 * Some requires just "<", others requires a difference precise sequence.
	 */

	START_TAG /** \<[a-zA-Z]\s+ */,
	START_TAG_ANNOTATION /** After the name */,
	ATTRIBUTE_START,
	ATTRIBUTE_VALUE,
	END_TAG,

	/**
	 * Parsed but useless and therefore ignored
	 * for subtitles purposes
	 */

	START_PI /** <? */,
	END_PI /** ?> */,

	START_CDATA /** <!CDATA[ */,
	END_CDATA /** ]]> */,

	START_COMMENT /** <!-- */,
	END_COMMENT /** --> */,

	START_VALIDATION_ENTITY /** <!ENTITY / <!ATTR */,
	END_VALIDATION_ENTITY /** > */,
}

export class Tokenizer {
	private startPoint = 0;
	private sourceWindow: ReturnType<typeof createTextSlidingWindow>;

	public constructor(rawContent: string) {
		this.sourceWindow = createTextSlidingWindow(rawContent, 0);
	}

	public static isWhitespace(character: string) {
		return character == " " || character == "\x09" || character == "\x0C";
	}

	public nextToken(): Token | null {
		if (this.sourceWindow.cursor >= this.sourceWindow.content.length) {
			return null;
		}

		/** Our token starts at this index of the raw content */
		this.startPoint = this.sourceWindow.cursor;

		let state: TokenizerState = TokenizerState.UNKNOWN_CONTENT;
		let result = "";

		let tagName: string;
		let attributes: { [key: string]: string } = {};
		let currentAttributeName = "";
		let currentAttributeValue = "";
		let insideString = false;

		while (this.sourceWindow.cursor <= this.sourceWindow.content.length) {
			const { char } = this.sourceWindow;

			switch (state) {
				case TokenizerState.UNKNOWN_CONTENT: {
					if (char !== "<") {
						break;
					}

					if (this.sourceWindow.peek("<?")) {
						state = TokenizerState.START_PI;
						break;
					}

					if (this.sourceWindow.peek("<!--")) {
						state = TokenizerState.START_COMMENT;
						break;
					}

					if (this.sourceWindow.peek("<![CDATA[")) {
						state = TokenizerState.START_CDATA;
						break;
					}

					if (this.sourceWindow.peek("<!")) {
						const { nextChar } = this.sourceWindow;
						const codePoint = nextChar.charCodeAt(0);
						const isUppercaseCharacter = codePoint >= 65 && codePoint <= 90;

						if (isValidName(nextChar) && isUppercaseCharacter) {
							state = TokenizerState.START_VALIDATION_ENTITY;
							break;
						}
					}

					if (this.sourceWindow.peek("</")) {
						state = TokenizerState.END_TAG;
						break;
					}

					if (isValidName(this.sourceWindow.nextChar)) {
						state = TokenizerState.START_TAG;
					}

					break;
				}

				case TokenizerState.START_PI: {
					/**
					 * We don't really care right now to
					 * do something with PROCESSING INSTRUCTIONS
					 * but collecting data and checking
					 * if we reached the end of this
					 * block.
					 */

					if (this.sourceWindow.peek("?>")) {
						state = TokenizerState.END_PI;
					} else {
						result += char;
					}

					break;
				}

				case TokenizerState.END_PI: {
					/**
					 * @TODO EMIT Processing Instruction token
					 */

					this.sourceWindow.advance();
					return;
				}

				case TokenizerState.START_COMMENT: {
					/**
					 * We don't really care right now to
					 * do something with COMMENTS but
					 * collecting data and checking if we
					 * reached the end of this block.
					 */

					if (this.sourceWindow.peek("-->")) {
						state = TokenizerState.END_COMMENT;
					} else {
						result += char;
					}

					break;
				}

				case TokenizerState.END_COMMENT: {
					/**
					 * @TODO EMIT Comment token
					 */

					this.sourceWindow.advance();
					return;
				}

				case TokenizerState.START_CDATA: {
					/**
					 * We don't really care right now to
					 * do something with CDATA but
					 * collecting data and checking if we
					 * reached the end of this block.
					 */

					if (this.sourceWindow.peek("]]>")) {
						state = TokenizerState.END_CDATA;
					} else {
						result += char;
					}

					break;
				}

				case TokenizerState.END_CDATA: {
					/**
					 * @TODO EMIT CDATA token
					 */

					this.sourceWindow.advance();
					return;
				}

				case TokenizerState.START_TAG: {
					if (this.sourceWindow.peek("/>")) {
						tagName = result;

						/**
						 * @TODO return token;
						 */

						return;
					}

					if (char === ">") {
						tagName = result;
						result = "";
						this.sourceWindow.advance();
						/**
						 * @TODO return token;
						 */

						return;
					}

					if (Tokenizer.isWhitespace(char)) {
						tagName = result;
						result = "";

						state = TokenizerState.START_TAG_ANNOTATION;
						break;
					}

					result += char;

					break;
				}

				case TokenizerState.END_TAG: {
					if (char === ">" || this.sourceWindow.cursor === this.sourceWindow.content.length) {
						this.sourceWindow.advance();
						tagName = result;

						/**
						 * @TODO return end tag
						 */

						return;
					}

					result += char;

					break;
				}

				case TokenizerState.START_TAG_ANNOTATION: {
					if (this.sourceWindow.peek("/>")) {
						this.sourceWindow.advance();

						/**
						 * @TODO return self-closing tag token;
						 */

						return;
					}

					if (isValidName(char)) {
						state = TokenizerState.ATTRIBUTE_START;
						result += char;
						break;
					}

					break;
				}

				case TokenizerState.ATTRIBUTE_START: {
					if (char === "=" || (Tokenizer.isWhitespace(char) && this.sourceWindow.peek("="))) {
						state = TokenizerState.ATTRIBUTE_VALUE;
						currentAttributeName = result;
						result = "";
						break;
					}

					if (Tokenizer.isWhitespace(char)) {
						state = TokenizerState.START_TAG_ANNOTATION;

						attributes[result] = undefined;
						result = "";
						break;
					}

					if (this.sourceWindow.peek("/>")) {
						this.sourceWindow.advance();
						attributes[result] = undefined;

						/**
						 * @TODO return self-closing tag token;
						 */

						return;
					}

					if (this.sourceWindow.peek(">")) {
						this.sourceWindow.advance();
						attributes[result] = undefined;

						/**
						 * @TODO return start tag token;
						 */

						return;
					}

					/**
					 * @TODO might want to check in the end if whole attribute name is actually valid
					 */

					if (isValidName(char)) {
						result += char;
					}

					break;
				}

				case TokenizerState.ATTRIBUTE_VALUE: {
					if (Tokenizer.isWhitespace(char) && result.length > 0) {
						state = TokenizerState.START_TAG_ANNOTATION;
						attributes[currentAttributeName] = result;

						result = "";
						currentAttributeName = "";

						break;
					}

					if (this.sourceWindow.peek("/>")) {
						attributes[currentAttributeName] = result;
						this.sourceWindow.advance();

						/**
						 * @TODO return self-closing tag token;
						 */

						return;
					}

					if (this.sourceWindow.peek(">")) {
						attributes[currentAttributeName] = result;
						this.sourceWindow.advance();

						/**
						 * @TODO return start tag token;
						 */

						return;
					}

					// Quotes get automatically excluded here
					if (isValidName(char)) {
						result += char;
					}

					break;
				}
			}

			this.sourceWindow.advance();
		}

		return null;
	}
}

function isValidNameStartChar(content: string): boolean {
	return NAME_START_CHAR_REGEX.test(content);
}

function isValidNameChar(content: string): boolean {
	return NAME_CHAR_REGEX.test(content);
}

function isValidName(content: string): boolean {
	return NAME_REGEX.test(content);
}
