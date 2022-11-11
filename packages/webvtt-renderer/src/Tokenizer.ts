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

import { Token } from "./Token.js";

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

const SHARED_DOM_PARSER = new DOMParser();

export class Tokenizer {
	/** Character index in the content */
	private cursor = 0;
	/** Next token index in the content */
	private startPoint = 0;

	constructor(private rawContent: string) {}

	static isWhitespace(character: string) {
		return character == " " || character == "\x09" || character == "\x0C";
	}

	static isNewLine(character: string) {
		return character == "\x0A";
	}

	/**
	 * Attempts to convert a set of character (a supposed HTML Entity)
	 * to the correct character, by accumulating its char code;
	 *
	 * @param source
	 * @param currentCursor
	 * @param additionalAllowedCharacters
	 * @returns
	 */

	static parseHTMLEntity(
		source: string,
		currentCursor: number,
		additionalAllowedCharacters: string[] = [],
	): [content: string, cursor: number] {
		if (!source?.length) {
			return ["", currentCursor];
		}

		let cursor = currentCursor;
		let result = "";

		/**
		 * This partial implementation, compared to Chromium's implementation
		 * is due to my lack of understanding and laziness of everything
		 * that concerns Unicode characters conversion. I mean, wth is this?
		 * It is okay for me until it is just matter of following parsing
		 * and states, but when it comes to decimals and unicodes... I'm out.
		 * It is better to use a DOMParser, even if it might be a little bit
		 * slower than native implementation (or... maybe not?).
		 *
		 * Maybe one day I'll try to understand this whole world.
		 * Right now, I'm going to integrate only the basic logic.
		 *
		 * @see https://github.com/chromium/chromium/blob/c4d3c31083a2e1481253ff2d24298a1dfe19c754/third_party/blink/renderer/core/html/parser/html_entity_parser.cc#L107
		 */

		while (cursor < source.length) {
			const char = source[cursor] as string;
			const maybeHTMLEntity = "&" + result + char;

			if (
				Tokenizer.isWhitespace(char) ||
				Tokenizer.isNewLine(char) ||
				char === "<" ||
				char === "&" ||
				additionalAllowedCharacters.includes(char)
			) {
				/**
				 * Not a valid HTMLEntity. Returning what we
				 * discovered, so it can be appended to the result
				 */
				return [maybeHTMLEntity, cursor];
			}

			if (char === ";") {
				return [
					SHARED_DOM_PARSER.parseFromString(maybeHTMLEntity, "text/html").documentElement
						.textContent || maybeHTMLEntity,
					cursor,
				];
			}

			result += char;
			cursor++;
		}

		return ["&" + result, cursor];
	}

	// ************************ //
	// *** INSTANCE METHODS *** //
	// ************************ //

	public nextToken(): Token | null {
		if (this.cursor >= this.rawContent.length) {
			return null;
		}

		/** Our token starts at this index of the raw content */
		this.startPoint = this.cursor;

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
			const char = this.rawContent[this.cursor] as string;

			switch (state) {
				case TokenizerState.DATA: {
					if (char === "&") {
						state = TokenizerState.HTML_CHARACTER_REFERENCE;
						break;
					}

					if (char === "<") {
						if (!result.length) {
							state = TokenizerState.TAG;
						} else {
							return Token.String(result, { start: this.startPoint, end: this.cursor });
						}

						break;
					}

					if (this.cursor === this.rawContent.length) {
						return Token.String(result, { start: this.startPoint, end: this.cursor });
					}

					result += char;
					break;
				}

				case TokenizerState.HTML_CHARACTER_REFERENCE: {
					const [content, nextCursor] = Tokenizer.parseHTMLEntity(this.rawContent, this.cursor);

					result += content;
					this.cursor = nextCursor;

					state = TokenizerState.DATA;
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
						return Token.StartTag(result, { start: this.startPoint, end: this.cursor }, classes);
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
						return Token.StartTag(result, { start: this.startPoint, end: this.cursor }, classes);
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
						return Token.StartTag(result, { start: this.startPoint, end: this.cursor }, classes);
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

						return Token.StartTag(
							result,
							{ start: this.startPoint, end: this.cursor },
							classes,
							/** \x20 is classic space (U+0020 SPACE character) */
							buffer.trim().replace(/\s+/g, "\x20").split("\x20"),
						);
					}

					buffer += char;
					break;
				}

				case TokenizerState.HTML_CHARACTER_REFERENCE_ANNOTATION: {
					const [content, nextCursor] = Tokenizer.parseHTMLEntity(this.rawContent, this.cursor, [
						">",
					]);

					buffer += content;
					this.cursor = nextCursor;

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
						return Token.EndTag(result, { start: this.startPoint, end: this.cursor });
					}

					result += char;
					break;
				}

				case TokenizerState.TIMESTAMP_TAG: {
					if (char === ">" || this.cursor === this.rawContent.length) {
						this.cursor++;
						return Token.TimestampTag(result, { start: this.startPoint, end: this.cursor });
					}

					if (Tokenizer.isWhitespace(char)) {
						/**
						 * Timestamp is incomplete and not a timestamp tag.
						 * TIMESTAMP_TAG can be accessed only from TAG and, before,
						 * from DATA.
						 */
						state = TokenizerState.DATA;
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
