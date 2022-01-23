/**
 * @see https://www.w3.org/TR/2019/CR-webvtt1-20190404/#webvtt-data-state
 *
 * An "annotation" is:
 * (1) the content between the tag name and the ">";
 * (2) the content between ">" and "<";
 *
 * As (1), some disallow them (c, i, u, b, ruby, rt). All but "ruby" (which take its from "rt") require one as (2)
 * As (1), some requires them (v, lang).
 *
 * Therefore the annotation state is after the "<" and the tag name
 *
 * @example
 *
 * ```vtt
 * <v Fred></v> (Fred)
 * <lang en-US></lang> (en-US)
 * ```
 */

enum TokenizerState {
	DATA,
	HTML_CHARACTER_REFERENCE,
	TAG,
	START_TAG,
	START_TAG_CLASS,
	START_TAG_ANNOTATION /** Content in tag */,
	HTML_CHARACTER_REFERENCE_ANNOTATION /** HTML Entity in annotation */,
	END_TAG,
	TIMESTAMP_TAG,
}

export class Tokenizer {
	private cursor = 0;

	constructor(private rawContent: string) {}

	static isWhitespace(character: string) {
		return character == " " || character == "\x09" || character == "\x0C";
	}

	static isNewLine(character: string) {
		return character == "\x0A";
	}

	static parseHTMLEntity(buffer: string): string | null {
		let cursor = 0;

		if (!buffer.length) {
			return null;
		}

		while (cursor < buffer.length) {
			const char = buffer[cursor];

			cursor++;
		}

		return null;
	}

	// ************************ //
	// *** INSTANCE METHODS *** //
	// ************************ //

	public nextToken(): Token {
		if (this.cursor >= this.rawContent.length) {
			return null;
		}

		let state: TokenizerState = TokenizerState.DATA;
		let result = "";

		/**
		 * Buffer is an additional container for data
		 * that should be associated to result but should
		 * not belong to the same content
		 */
		let buffer = "";

		const classes: string[] = [];

		while (this.cursor <= this.rawContent.length) {
			const char = this.rawContent[this.cursor];

			/** Screw you, Typescript */
			switch (state as TokenizerState) {
				case TokenizerState.DATA: {
					if (char === "&") {
						state = TokenizerState.HTML_CHARACTER_REFERENCE;
						break;
					}

					if (char === "<") {
						if (!result.length) {
							state = TokenizerState.TAG;
						} else {
							return Token.String(result);
						}

						break;
					}

					if (this.cursor === this.rawContent.length) {
						return Token.String(result);
					}

					result += char;
					break;
				}

				case TokenizerState.HTML_CHARACTER_REFERENCE: {
					/** @TODO Attempt to consume html character */
					break;
				}

				case TokenizerState.TAG: {
					if (Tokenizer.isWhitespace(char) || Tokenizer.isNewLine(char)) {
						state = TokenizerState.START_TAG_ANNOTATION;
						break;
					}

					if (char === ".") {
						state = TokenizerState.START_TAG_CLASS;
						break;
					}

					if (char === "/") {
						state = TokenizerState.END_TAG;
						break;
					}

					if (!Number.isNaN(parseInt(char))) {
						state = TokenizerState.TIMESTAMP_TAG;
						result += char;
						break;
					}

					if (this.cursor === this.rawContent.length) {
						this.cursor++;
						return Token.StartTag(result);
					}

					state = TokenizerState.START_TAG;
					result += char;
					break;
				}

				case TokenizerState.START_TAG: {
					if (Tokenizer.isWhitespace(char)) {
						state = TokenizerState.START_TAG_ANNOTATION;
						break;
					}

					if (Tokenizer.isNewLine(char)) {
						buffer += char;
						state = TokenizerState.START_TAG_ANNOTATION;
						break;
					}

					if (char === ".") {
						state = TokenizerState.START_TAG_CLASS;
						break;
					}

					if (char === ">" || this.cursor === this.rawContent.length) {
						this.cursor++;
						return Token.StartTag(result);
					}

					result += char;
					break;
				}

				case TokenizerState.START_TAG_CLASS: {
					if (Tokenizer.isWhitespace(char)) {
						classes.push(buffer);
						buffer = "";
						state = TokenizerState.START_TAG_ANNOTATION;
						break;
					}

					if (Tokenizer.isNewLine(char)) {
						buffer += char;
						state = TokenizerState.START_TAG_ANNOTATION;
						break;
					}

					if (char === ".") {
						classes.push(buffer);
						buffer = "";
						break;
					}

					if (char === ">" || this.cursor === this.rawContent.length) {
						this.cursor++;
						classes.push(buffer);
						return Token.StartTag(result, classes);
					}

					buffer += char;
					break;
				}

				case TokenizerState.START_TAG_ANNOTATION: {
					if (char === "&") {
						state = TokenizerState.HTML_CHARACTER_REFERENCE_ANNOTATION;
						break;
					}

					if (char === ">" || this.cursor === this.rawContent.length) {
						this.cursor++;

						/** \x20 is classic space (U+0020 SPACE character) */
						return Token.StartTag(result, classes, buffer.trim().replace(/\s+/g, "\x20"));
					}

					buffer += char;
					break;
				}

				case TokenizerState.HTML_CHARACTER_REFERENCE_ANNOTATION: {
					/** @TODO Attempt to consume html character, by also allowing ">" */
					/** @TODO if nothing is returned, append char to result */

					state = TokenizerState.START_TAG_ANNOTATION;
					break;
				}

				case TokenizerState.END_TAG: {
					/**
					 * Reminder: this will be accessed only if we have found a
					 * "/" first in a Tag state
					 */

					if (char === ">" || this.cursor === this.rawContent.length) {
						this.cursor++;
						return Token.EndTag(result);
					}

					result += char;
					break;
				}

				case TokenizerState.TIMESTAMP_TAG: {
					if (char === ">" || this.cursor === this.rawContent.length) {
						this.cursor++;
						return Token.TimestampTag(result);
					}

					result += char;
					break;
				}
			}

			this.cursor++;
		}
	}
}

export enum TokenType {
	STRING,
	START_TAG,
	END_TAG,
	TIMESTAMP,
}

export class Token {
	public annotations: string;
	public classes: string[];

	private constructor(public type: TokenType, private content: string) {}

	static String(content: string): Token {
		return new Token(TokenType.STRING, content);
	}

	static StartTag(tagName: string, classes?: string[], annotations?: string): Token {
		const token = new Token(TokenType.START_TAG, tagName);

		token.classes = classes;
		token.annotations = annotations;

		return token;
	}

	static EndTag(tagName: string): Token {
		return new Token(TokenType.END_TAG, tagName);
	}

	static TimestampTag(timestampRaw: string): Token {
		return new Token(TokenType.TIMESTAMP, timestampRaw);
	}
}
