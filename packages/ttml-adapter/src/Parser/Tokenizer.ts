import { Token } from "./Token.js";

/**
 * @see https://www.w3.org/TR/xml/#sec-common-syn
 */

const NAME_START_CHAR_REGEX =
	/:|_|[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}]/u;
const NAME_CHAR_REGEX = new RegExp(
	`${NAME_START_CHAR_REGEX.source}|-|\.|[0-9\xB7\u0300-\u036F\u203F-\u2040]`,
);
const NAME_REGEX = new RegExp(`${NAME_START_CHAR_REGEX.source}(${NAME_CHAR_REGEX.source})*`);

function createTextSlidingWindow(content: string, startingIndex: number) {
	let cursor: number = startingIndex;

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
		peekAdvance(evaluation: string): boolean {
			const amountOfWhitespacesNextCurrentChar = Math.max(
				0,
				getAmountOfWhitespacesNext(content, cursor),
			);

			let nextIndex: number = 0;

			if (
				content.substring(
					cursor + amountOfWhitespacesNextCurrentChar + 1,
					cursor + evaluation.length + amountOfWhitespacesNextCurrentChar + 1,
				) !== evaluation
			) {
				return false;
			}

			/**
			 * When we have one character, we want to skip it and go
			 * to straight on the next one.
			 */
			nextIndex += evaluation.length + amountOfWhitespacesNextCurrentChar + 1;
			cursor += nextIndex;

			return true;
		},
		peek(dataOrFunction: (char: string, relativeIndex: number) => boolean): boolean {
			const amountOfWhitespacesNextCurrentChar = Math.max(
				0,
				getAmountOfWhitespacesNext(content, cursor),
			);
			let nextIndex: number = 0;

			if (
				!dataOrFunction(
					content[cursor + amountOfWhitespacesNextCurrentChar + 1],
					cursor + amountOfWhitespacesNextCurrentChar + nextIndex + 1,
				)
			) {
				return false;
			}

			cursor += nextIndex + amountOfWhitespacesNextCurrentChar + 1;

			return true;
		},
		advance() {
			cursor++;
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
	DATA,
	END_TAG,

	/**
	 * Parsed but useless and therefore ignored
	 * for subtitles purposes
	 */

	PROCESSING_INSTRUCTION /** <? ?>*/,

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
		return character === "\x20" || character === "\x09" || character === "\x0C";
	}

	public static isNewLine(character: string) {
		return character === "\x0A";
	}

	public static isQuotationMark(character: string): boolean {
		return (
			/* " */ character === "\u0022" ||
			/* “ */ character === "\u201C" ||
			/* ” */ character === "\u201D" ||
			/* „ */ character === "\u201E" ||
			/* ‟ */ character === "\u201F"
		);
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

		while (this.sourceWindow.cursor <= this.sourceWindow.content.length) {
			const { char } = this.sourceWindow;

			switch (state) {
				case TokenizerState.UNKNOWN_CONTENT: {
					if (char !== "<") {
						if (Tokenizer.isWhitespace(char) || Tokenizer.isNewLine(char)) {
							this.sourceWindow.advance();
							break;
						}

						result += char;
						state = TokenizerState.DATA;

						this.sourceWindow.advance();
						break;
					}

					if (this.sourceWindow.peekAdvance("?")) {
						state = TokenizerState.PROCESSING_INSTRUCTION;
						break;
					}

					if (this.sourceWindow.peekAdvance("!--")) {
						state = TokenizerState.START_COMMENT;
						break;
					}

					if (this.sourceWindow.peekAdvance("![CDATA[")) {
						state = TokenizerState.START_CDATA;
						break;
					}

					if (this.sourceWindow.peekAdvance("!")) {
						const { nextChar } = this.sourceWindow;
						const codePoint = nextChar.charCodeAt(0);
						const isUppercaseCharacter = codePoint >= 65 && codePoint <= 90;

						if (isValidName(nextChar) && isUppercaseCharacter) {
							state = TokenizerState.START_VALIDATION_ENTITY;
							break;
						}
					}

					if (this.sourceWindow.peekAdvance("/")) {
						state = TokenizerState.END_TAG;
						break;
					}

					if (isValidName(this.sourceWindow.nextChar)) {
						state = TokenizerState.START_TAG;
					}

					/**
					 * @TODO should throw a parsing error if this is not
					 * a valid name character, but meanwhile, this line
					 * allows us to go on and not go into an infinite loop
					 */

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.START_VALIDATION_ENTITY: {
					/**
					 * We don't really care right now to
					 * do something with CDATA but
					 * collecting data and checking if we
					 * reached the end of this block.
					 */

					result += char;

					if (this.sourceWindow.peekAdvance(">")) {
						state = TokenizerState.END_VALIDATION_ENTITY;
					}

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.END_VALIDATION_ENTITY: {
					this.sourceWindow.advance();
					return Token.ValidationEntity(result);
				}

				case TokenizerState.PROCESSING_INSTRUCTION: {
					/**
					 * We don't really care right now to
					 * do something with PROCESSING INSTRUCTIONS
					 * but collecting data and checking
					 * if we reached the end of this
					 * block.
					 */

					result += char;

					if (this.sourceWindow.peekAdvance("?>")) {
						return Token.ProcessingInstruction(result);
					}

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.START_COMMENT: {
					/**
					 * We don't really care right now to
					 * do something with COMMENTS but
					 * collecting data and checking if we
					 * reached the end of this block.
					 */

					result += char;

					if (this.sourceWindow.peekAdvance("-->")) {
						state = TokenizerState.END_COMMENT;
					}

					this.sourceWindow.advance();

					break;
				}

				case TokenizerState.END_COMMENT: {
					this.sourceWindow.advance();
					return Token.Comment(result);
				}

				case TokenizerState.START_CDATA: {
					/**
					 * We don't really care right now to
					 * do something with CDATA but
					 * collecting data and checking if we
					 * reached the end of this block.
					 */

					result += char;

					if (this.sourceWindow.peekAdvance("]]>")) {
						state = TokenizerState.END_CDATA;
					}

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.END_CDATA: {
					this.sourceWindow.advance();
					return Token.CData(result);
				}

				case TokenizerState.START_TAG: {
					if (this.sourceWindow.peekAdvance("/>")) {
						tagName = result + char;

						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peekAdvance(">")) {
						tagName = result + char;

						return Token.StartTag(tagName, attributes);
					}

					if (Tokenizer.isWhitespace(char) || Tokenizer.isNewLine(char)) {
						tagName = result;
						result = "";
						state = TokenizerState.START_TAG_ANNOTATION;

						this.sourceWindow.advance();
						break;
					}

					result += char;

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.END_TAG: {
					if (
						this.sourceWindow.peekAdvance(">") ||
						this.sourceWindow.cursor === this.sourceWindow.content.length
					) {
						tagName = result + char;

						return Token.EndTag(tagName);
					}

					result += char;

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.DATA: {
					if (char === "<") {
						return Token.String(result.trim());
					}

					result += char;

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.START_TAG_ANNOTATION: {
					if (this.sourceWindow.peekAdvance("/>")) {
						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peekAdvance(">")) {
						if (result.length) {
							attributes[result] = undefined;
						}

						return Token.StartTag(tagName, attributes);
					}

					if (isValidName(char)) {
						state = TokenizerState.ATTRIBUTE_START;
						result += char;
					}

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.ATTRIBUTE_START: {
					if (this.sourceWindow.peekAdvance("=")) {
						state = TokenizerState.ATTRIBUTE_VALUE;

						if (!Tokenizer.isWhitespace(char) && !Tokenizer.isNewLine(char)) {
							result += char;
						}

						currentAttributeName = result;
						result = "";

						break;
					}

					if (Tokenizer.isWhitespace(char) || Tokenizer.isNewLine(char)) {
						this.sourceWindow.advance();
						state = TokenizerState.START_TAG_ANNOTATION;

						attributes[result] = undefined;
						result = "";

						break;
					}

					if (this.sourceWindow.peekAdvance("/>")) {
						attributes[result] = undefined;

						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peekAdvance(">")) {
						attributes[result] = undefined;

						return Token.StartTag(tagName, attributes);
					}

					/**
					 * @TODO might want to check in the end if whole attribute name is actually valid
					 */

					if (isValidName(char)) {
						result += char;
					}

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.ATTRIBUTE_VALUE: {
					if (this.sourceWindow.peekAdvance("/>")) {
						attributes[currentAttributeName] = result.trimEnd();

						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peekAdvance(">")) {
						attributes[currentAttributeName] = result.trimEnd();

						return Token.StartTag(tagName, attributes);
					}

					if (
						Tokenizer.isQuotationMark(char) ||
						this.sourceWindow.peek(Tokenizer.isQuotationMark)
					) {
						if (!result.length) {
							currentAttributeValue = this.sourceWindow.char;

							this.sourceWindow.advance();
							break;
						}

						/**
						 * If this happens, the char got updated through peek
						 */
						if (this.sourceWindow.char === currentAttributeValue) {
							state = TokenizerState.START_TAG_ANNOTATION;
							attributes[currentAttributeName] = result + char;

							result = "";
							currentAttributeValue = "";
							currentAttributeName = "";

							break;
						}
					}

					result += Tokenizer.isNewLine(char) ? "\x20" : char;

					this.sourceWindow.advance();
					break;
				}
			}
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

function getAmountOfWhitespacesNext(content: string, cursor: number): number {
	let updatedCursor = cursor + 1;

	while (
		(Tokenizer.isWhitespace(content[updatedCursor]) ||
			Tokenizer.isNewLine(content[updatedCursor])) &&
		updatedCursor++
	) {}

	return updatedCursor - cursor - 1;
}
