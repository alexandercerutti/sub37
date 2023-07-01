import { Token } from "./Token.js";

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
		peek(dataOrFunction: string | ((char: string, relativeIndex: number) => boolean)): boolean {
			let nextIndex: number = 0;

			if (typeof dataOrFunction === "string") {
				if (content.substring(cursor + 1, cursor + dataOrFunction.length + 1) !== dataOrFunction) {
					return false;
				}

				nextIndex += dataOrFunction.length;
			} else {
				if (!dataOrFunction(content[cursor + 1], cursor + nextIndex + 1)) {
					return false;
				}

				nextIndex++;
			}

			cursor += nextIndex;
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

	public static isNewLine(character: string) {
		return character == "\x0A";
	}

	public static isQuotationMark(character: string) {
		return (
			character == "\u0022" ||
			character === "\u201C" ||
			character === "\u201D" ||
			character === "\u201E" ||
			character === "\u201F"
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
							break;
						}

						result += char;
						state = TokenizerState.DATA;

						break;
					}

					if (this.sourceWindow.peek("?")) {
						state = TokenizerState.START_PI;
						break;
					}

					if (this.sourceWindow.peek("!--")) {
						state = TokenizerState.START_COMMENT;
						break;
					}

					if (this.sourceWindow.peek("![CDATA[")) {
						state = TokenizerState.START_CDATA;
						break;
					}

					if (this.sourceWindow.peek("!")) {
						const { nextChar } = this.sourceWindow;
						const codePoint = nextChar.charCodeAt(0);
						const isUppercaseCharacter = codePoint >= 65 && codePoint <= 90;

						if (isValidName(nextChar) && isUppercaseCharacter) {
							state = TokenizerState.START_VALIDATION_ENTITY;
							break;
						}
					}

					if (this.sourceWindow.peek("/")) {
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

					result += char;

					if (this.sourceWindow.peek("?>")) {
						state = TokenizerState.END_PI;
					}

					break;
				}

				case TokenizerState.END_PI: {
					this.sourceWindow.advance();
					return Token.ProcessingIntruction(result);
				}

				case TokenizerState.START_COMMENT: {
					/**
					 * We don't really care right now to
					 * do something with COMMENTS but
					 * collecting data and checking if we
					 * reached the end of this block.
					 */

					result += char;

					if (this.sourceWindow.peek("-->")) {
						state = TokenizerState.END_COMMENT;
					}

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

					if (this.sourceWindow.peek("]]>")) {
						state = TokenizerState.END_CDATA;
					}

					break;
				}

				case TokenizerState.END_CDATA: {
					this.sourceWindow.advance();
					return Token.CData(result);
				}

				case TokenizerState.START_TAG: {
					if (this.sourceWindow.peek("/>")) {
						tagName = result;

						return Token.Tag(tagName, attributes);
					}

					if (char === ">") {
						tagName = result;
						result = "";
						this.sourceWindow.advance();

						return Token.StartTag(tagName, attributes);
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

						return Token.EndTag(tagName);
					}

					result += char;

					break;
				}

				case TokenizerState.DATA: {
					result += char;

					if (this.sourceWindow.peek("<")) {
						return Token.String(result);
					}

					break;
				}

				case TokenizerState.START_TAG_ANNOTATION: {
					if (this.sourceWindow.peek("/>")) {
						this.sourceWindow.advance();

						return Token.Tag(tagName, attributes);
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

						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peek(">")) {
						this.sourceWindow.advance();
						attributes[result] = undefined;

						return Token.StartTag(tagName, attributes);
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
					if (this.sourceWindow.peek("/>")) {
						attributes[currentAttributeName] = result;
						this.sourceWindow.advance();

						return Token.Tag(tagName, attributes);
					}

					if (this.sourceWindow.peek(">")) {
						attributes[currentAttributeName] = result;
						this.sourceWindow.advance();

						return Token.StartTag(tagName, attributes);
					}

					if (!Tokenizer.isQuotationMark(char)) {
						result += char;
						break;
					}

					if (!result.length) {
						/**
						 * Starting or ending quotes and respective spaces can be ignored
						 * but saving the character to compare it later
						 */
						currentAttributeValue = char;
						break;
					}

					if (
						this.sourceWindow.char === currentAttributeValue &&
						this.sourceWindow.peek(Tokenizer.isWhitespace)
					) {
						state = TokenizerState.START_TAG_ANNOTATION;
						attributes[currentAttributeName] = result;

						result = "";
						currentAttributeValue = "";
						currentAttributeName = "";
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
