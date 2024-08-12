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

interface PeekEvaluator<Search extends string> {
	check(chars: Search): boolean;
	readonly requestedCharacters: number;
}

function createEvaluator<Search extends string>(
	evaluationFn: (chars: string) => boolean,
	charsAmount: number,
): PeekEvaluator<Search> {
	return {
		check: evaluationFn,
		requestedCharacters: charsAmount,
	};
}

function createCheckForString<Search extends string>(evalString: Search): PeekEvaluator<Search> {
	return createEvaluator(function check(chars: string) {
		return chars === evalString;
	}, evalString.length);
}

const PI_BEGIN_CHECKER = createCheckForString("?");
const PI_END_CHECKER = createCheckForString("?>");
const COMMENT_BEGIN_CHECKER = createCheckForString("!--");
const COMMENT_END_CHECKER = createCheckForString("-->");
const CDATA_BEGIN_CHECKER = createCheckForString("![CDATA[");
const CDATA_END_CHECKER = createCheckForString("]]>");
const VE_BEGIN_CHECKER = createCheckForString("!");
const START_TAG_CHECKER = createCheckForString("<");
const END_TAG_CHECKER = createCheckForString("/");
const CLOSE_TAG_CHECKER = createCheckForString(">");
const EMPTY_TAG_CHECKER = createCheckForString("/>");
const ATTRIBUTE_SEPARATOR_CHECKER = createCheckForString("=");
const QUOTATION_MARK_CHECKER = createEvaluator(isQuotationMark, 1);

function isQuotationMark(character: string): boolean {
	return (
		/* " */ character === "\u0022"

		// Unsupported by XML
		/* “ */ /* character === "\u201C" ||*/
		/* ” */ /* character === "\u201D" ||*/
		/* „ */ /* character === "\u201E" ||*/
		/* ‟ */ /* character === "\u201F"*/
	);
}

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
		/**
		 * Looks at the next N characters, according to the
		 * function specification and jumps to the last
		 * character of check, if a match happened.
		 *
		 * @returns
		 */
		peekAdvance({ check, requestedCharacters }: PeekEvaluator<string>): boolean {
			const amountOfWhitespacesNextCurrentChar = Math.max(
				0,
				getAmountOfWhitespacesNext(content, cursor),
			);

			const nextCharIndexNoSpaces = cursor + amountOfWhitespacesNextCurrentChar;
			const evaluation = check(
				content.substring(
					nextCharIndexNoSpaces + 1,
					nextCharIndexNoSpaces + 1 + requestedCharacters,
				),
			);

			if (!evaluation) {
				return false;
			}

			cursor = requestedCharacters + nextCharIndexNoSpaces;

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

	public nextToken(): Token | null {
		if (this.sourceWindow.cursor >= this.sourceWindow.content.length) {
			return null;
		}

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

					if (this.sourceWindow.peekAdvance(PI_BEGIN_CHECKER)) {
						state = TokenizerState.PROCESSING_INSTRUCTION;

						this.sourceWindow.advance();
						break;
					}

					if (this.sourceWindow.peekAdvance(COMMENT_BEGIN_CHECKER)) {
						state = TokenizerState.START_COMMENT;

						this.sourceWindow.advance();
						break;
					}

					if (this.sourceWindow.peekAdvance(CDATA_BEGIN_CHECKER)) {
						state = TokenizerState.START_CDATA;

						this.sourceWindow.advance();
						break;
					}

					if (this.sourceWindow.peekAdvance(VE_BEGIN_CHECKER)) {
						const { nextChar } = this.sourceWindow;
						const codePoint = nextChar.charCodeAt(0);
						const isUppercaseCharacter = codePoint >= 65 && codePoint <= 90;

						this.sourceWindow.advance();

						if (isValidName(nextChar) && isUppercaseCharacter) {
							state = TokenizerState.START_VALIDATION_ENTITY;
							break;
						}
					}

					if (this.sourceWindow.peekAdvance(END_TAG_CHECKER)) {
						state = TokenizerState.END_TAG;

						this.sourceWindow.advance();
						break;
					}

					if (isValidName(this.sourceWindow.nextChar)) {
						state = TokenizerState.START_TAG;

						this.sourceWindow.advance();
						break;
					}

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

					if (this.sourceWindow.peekAdvance(CLOSE_TAG_CHECKER)) {
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

					if (this.sourceWindow.peekAdvance(PI_END_CHECKER)) {
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

					if (this.sourceWindow.peekAdvance(COMMENT_END_CHECKER)) {
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

					if (this.sourceWindow.peekAdvance(CDATA_END_CHECKER)) {
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
					if (this.sourceWindow.peekAdvance(EMPTY_TAG_CHECKER)) {
						tagName = result + char;

						this.sourceWindow.advance();
						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peekAdvance(CLOSE_TAG_CHECKER)) {
						tagName = result + char;

						this.sourceWindow.advance();
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
					result += char;

					if (
						this.sourceWindow.peekAdvance(CLOSE_TAG_CHECKER) ||
						this.sourceWindow.cursor === this.sourceWindow.content.length
					) {
						tagName = result;

						this.sourceWindow.advance();
						return Token.EndTag(tagName);
					}

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.DATA: {
					result += char;

					if (this.sourceWindow.peekAdvance(START_TAG_CHECKER)) {
						return Token.String(result.trim());
					}

					this.sourceWindow.advance();
					break;
				}

				case TokenizerState.START_TAG_ANNOTATION: {
					if (this.sourceWindow.peekAdvance(EMPTY_TAG_CHECKER)) {
						this.sourceWindow.advance();
						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peekAdvance(CLOSE_TAG_CHECKER)) {
						if (result.length) {
							attributes[result] = undefined;
						}

						this.sourceWindow.advance();
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
					if (this.sourceWindow.peekAdvance(ATTRIBUTE_SEPARATOR_CHECKER)) {
						state = TokenizerState.ATTRIBUTE_VALUE;

						if (!Tokenizer.isWhitespace(char) && !Tokenizer.isNewLine(char)) {
							result += char;
						}

						currentAttributeName = result;
						result = "";

						break;
					}

					if (Tokenizer.isWhitespace(char) || Tokenizer.isNewLine(char)) {
						state = TokenizerState.START_TAG_ANNOTATION;

						attributes[result] = undefined;
						result = "";

						this.sourceWindow.advance();
						break;
					}

					if (this.sourceWindow.peekAdvance(EMPTY_TAG_CHECKER)) {
						attributes[result] = undefined;

						this.sourceWindow.advance();
						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peekAdvance(CLOSE_TAG_CHECKER)) {
						attributes[result] = undefined;

						this.sourceWindow.advance();
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
					if (this.sourceWindow.peekAdvance(EMPTY_TAG_CHECKER)) {
						attributes[currentAttributeName] = result.trimEnd();

						this.sourceWindow.advance();
						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peekAdvance(CLOSE_TAG_CHECKER)) {
						attributes[currentAttributeName] = result.trimEnd();

						this.sourceWindow.advance();
						return Token.StartTag(tagName, attributes);
					}

					if (isQuotationMark(char) || this.sourceWindow.peekAdvance(QUOTATION_MARK_CHECKER)) {
						if (!result.length) {
							currentAttributeValue = this.sourceWindow.char;

							this.sourceWindow.advance();
							break;
						}

						if (this.sourceWindow.char === currentAttributeValue) {
							/**
							 * If this happens, the char got updated through peek
							 */
							state = TokenizerState.START_TAG_ANNOTATION;
							attributes[currentAttributeName] = result + char;

							result = "";
							currentAttributeValue = "";
							currentAttributeName = "";

							/**
							 * No need to advance. We completed the attribute
							 * but if the next character is a closing tag,
							 * we are going to fuck ourselved. Instead, it
							 * can be START_TAG_ANNOTATION to say what should
							 * we do, as we could have as many whitespaces
							 * as we want after quotes.
							 */

							break;
						}

						/**
						 * @TODO should we throw an error in this case?
						 */

						this.sourceWindow.advance();
						break;
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
