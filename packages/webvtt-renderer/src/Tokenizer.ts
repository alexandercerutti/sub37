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
		return character == " " || character == "\x0A" || character == "\x09" || character == "\x0C";
	}

	public nextToken(): Token {
		if (this.cursor >= this.rawContent.length) {
			return null;
		}

		let state: TokenizerState = TokenizerState.DATA;
		let result = "";

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
					if (Tokenizer.isWhitespace(char)) {
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
					break;
				}

				case TokenizerState.START_TAG_ANNOTATION: {
					if (char === "&") {
						state = TokenizerState.HTML_CHARACTER_REFERENCE_ANNOTATION;
						break;
					}

					if (char === ">" || this.cursor === this.rawContent.length) {
						this.cursor++;

						/**
						 * @TODO
						 * Remove any leading or trailing ASCII whitespace characters from buffer,
						 * and replace any sequence of one or more consecutive ASCII whitespace
						 * characters in buffer with a single U+0020 SPACE character;
						 *
						 * then, return a start tag whose tag name is result, with the classes
						 * given in classes, and with buffer as the annotation, and abort these steps.
						 */

						return Token.StartTag(result);
					}

					result += char;
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
	private constructor(public type: TokenType, private content: string) {}

	static String(content: string): Token {
		return new Token(TokenType.STRING, content);
	}

	static StartTag(content: string): Token {
		return new Token(TokenType.START_TAG, content);
	}

	static EndTag(content: string): Token {
		return new Token(TokenType.END_TAG, content);
	}

	static TimestampTag(content: string): Token {
		return new Token(TokenType.TIMESTAMP, content);
	}
}
