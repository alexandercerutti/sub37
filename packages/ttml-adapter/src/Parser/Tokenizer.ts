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

function createContentPeeker(content: string, startingIndex: number) {
	let lastResult = -1;

	return {
		peek(data: string): boolean {
			let nextIndex: number = startingIndex;

			do {
				if (data[nextIndex] !== content[nextIndex]) {
					lastResult = -1;
					return false;
				}
			} while (++nextIndex < startingIndex + data.length);

			lastResult = nextIndex;
			return true;
		},
		getLastResultIndex() {
			return lastResult;
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
	ATTRIBUTE_END,
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
	private cursor = 0;
	private startPoint = 0;
	private rawContent: string;

	public constructor(rawContent: string) {
		this.rawContent = rawContent;
	}

	public static isWhitespace(character: string) {
		return character == " " || character == "\x09" || character == "\x0C";
	}

	public nextToken(): Token | null {
		if (this.cursor >= this.rawContent.length) {
			return null;
		}

		/** Our token starts at this index of the raw content */
		this.startPoint = this.cursor;

		let state: TokenizerState = TokenizerState.UNKNOWN_CONTENT;
		let result = "";

		let tagName;
		let attributes;
		let currentAttributeName;
		let currentValueContent;

		while (this.cursor <= this.rawContent.length) {
			const char = this.rawContent[this.cursor] as string;
			const looker = createContentPeeker(this.rawContent, this.cursor);

			switch (state) {
				case TokenizerState.UNKNOWN_CONTENT: {
					if (char !== "<") {
						break;
					}

					if (looker.peek("<?")) {
						state = TokenizerState.START_PI;
						this.cursor = looker.getLastResultIndex();
						break;
					}

					if (looker.peek("<!--")) {
						state = TokenizerState.START_COMMENT;
						this.cursor = looker.getLastResultIndex();
						break;
					}

					if (looker.peek("<![CDATA[")) {
						state = TokenizerState.START_CDATA;
						this.cursor = looker.getLastResultIndex();
						break;
					}

					if (looker.peek("<!")) {
						const lookerNextCharacter = this.rawContent[looker.getLastResultIndex() + 1];
						const codePoint = lookerNextCharacter.charCodeAt(0);
						const isUppercaseCharacter = codePoint >= 65 && codePoint <= 90;

						if (isValidName(lookerNextCharacter) && isUppercaseCharacter) {
							state = TokenizerState.START_VALIDATION_ENTITY;
							break;
						}
					}

					if (looker.peek("</")) {
						state = TokenizerState.END_TAG;
						break;
					}

					if (isValidName(this.rawContent[this.cursor + 1])) {
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

					if (looker.peek("?>")) {
						state = TokenizerState.END_PI;
						this.cursor = looker.getLastResultIndex();
					} else {
						result += char;
					}

					break;
				}

				case TokenizerState.END_PI: {
					/**
					 * @TODO EMIT Processing Instruction token
					 */

					break;
				}

				case TokenizerState.START_COMMENT: {
					/**
					 * We don't really care right now to
					 * do something with COMMENTS but
					 * collecting data and checking if we
					 * reached the end of this block.
					 */

					if (looker.peek("-->")) {
						state = TokenizerState.END_COMMENT;
						this.cursor = looker.getLastResultIndex();
					} else {
						result += char;
					}

					break;
				}

				case TokenizerState.END_COMMENT: {
					/**
					 * @TODO EMIT Comment token
					 */

					break;
				}

				case TokenizerState.START_CDATA: {
					/**
					 * We don't really care right now to
					 * do something with CDATA but
					 * collecting data and checking if we
					 * reached the end of this block.
					 */

					if (looker.peek("]]>")) {
						state = TokenizerState.END_CDATA;
						this.cursor = looker.getLastResultIndex();
					} else {
						result += char;
					}

					break;
				}

				case TokenizerState.END_CDATA: {
					/**
					 * @TODO EMIT CDATA token
					 */

					break;
				}

				case TokenizerState.START_TAG: {
					if (char === ">") {
						tagName = result;
						result = "";

						/**
						 * @TODO return token;
						 */

						return;
					}

					if (Tokenizer.isWhitespace(char)) {
						tagName = result;
						result = "";

						state = TokenizerState.START_TAG_ANNOTATION;
					}

					result += char;

					break;
				}

				case TokenizerState.END_TAG: {
					if (char === ">" || this.cursor === this.rawContent.length) {
						this.cursor++;
						tagName = result;

						/**
						 * @TODO return end tag
						 */

						return;
					}

					result += char;

					break;
				}
			}

			this.cursor++;
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
