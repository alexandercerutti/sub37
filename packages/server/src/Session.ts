import type { RawTrack } from "./model";
import { CueNode } from "./CueNode.js";
import { IntervalBinaryTree } from "./IntervalBinaryTree.js";
import { HSBaseRendererConstructor } from "./BaseRenderer/index.js";

const activeTrackSymbol = Symbol("session.active");

export class HSSession {
	private timelines: { [lang: string]: IntervalBinaryTree<CueNode> } = Object.create(null);
	private [activeTrackSymbol]: string = null;

	constructor(rawContents: RawTrack[], public renderer: InstanceType<HSBaseRendererConstructor>) {
		for (let { lang, content } of rawContents) {
			try {
				const cues = renderer.parse(content);

				if (cues.length) {
					this.timelines[lang] = new IntervalBinaryTree();

					for (const cue of cues) {
						if (!(cue instanceof CueNode)) {
							continue;
						}

						this.timelines[lang].addNode(cue);
					}
				}
			} catch (err) {
				console.error(err);
				/**
				 * @TODO Emit renderer error
				 */
			}
		}

		if (Object.keys(this.timelines).length) {
			this.activeTrack = Object.keys(this.timelines)[0];
		}
	}

	public getAll(): CueNode[] {
		return this.timelines[this[activeTrackSymbol]].getAll();
	}

	public get availableTracks(): string[] {
		return Object.keys(this.timelines);
	}

	public get activeTrack(): string {
		return this[activeTrackSymbol];
	}

	public set activeTrack(lang: string) {
		if (!this.timelines[lang]) {
			console.warn("Missing language. Active track wasn't set.");
			return;
		}

		this[activeTrackSymbol] = lang;
	}

	public getActiveCues(time: number): CueNode[] {
		if (!this.activeTrack) {
			throw new Error("No active track found. Cannot retrieve active cues");
		}

		return this.timelines[this.activeTrack].getCurrentNodes(time);
	}
}

function convertBufferToUTF8View(payload: ArrayBuffer) {
	return new TextDecoder("utf-8").decode(getUTF8View(payload)?.buffer);
}

function getUTF8View(payload: ArrayBuffer): Uint8Array {
	const charView = new Uint8Array(payload);

	if (isUTF8Array(charView)) {
		return charView;
	}

	/**
	 * Converting buffer to string, whatever is it's encoding.
	 * According to the web, one of the most used ways to do
	 * this, seems to be by doing
	 *
	 * ```
	 * String.fromCharCode.apply(null, buffer)
	 * ```
	 *
	 * Sadly, and according to both experiments and other sources,
	 * (https://stackoverflow.com/a/19102224) on some browsers, e.g.
	 * Safari for sure, excessive long buffers might cause a
	 * `Range Error: Maximum call stack size exceeded`.
	 * This is the case of passing long texts, like VTTs for contents
	 * that last over 1 hour.
	 *
	 * @ref https://bit.ly/3xqXibJ
	 *
	 * For this reason we need to look for another way.
	 *
	 * At the same time, other answers on the web recommend using
	 * a TextDecoder to decode the text. We cannot use this solution,
	 * as we are not sure about which is the encoding we'll receive
	 * and, also, passing the text as-is to TextDecoder, produces a
	 * series of null characters (\u0000), probably due to the fact
	 * that the text is composed of multibyte formats, which are
	 * undesided.
	 *
	 * Chunking seems to be the best way to achieve the content.
	 */

	const payloadString = convertUint8ArrayToString(charView);
	return new TextEncoder().encode(payloadString);
}

function convertUint8ArrayToString(array: Uint8Array) {
	// Creating chunks of 32768 characters
	const CHUNK_SIZE = 0x8000;
	const chunks = [];

	for (var i = 0; i < array.length; i += CHUNK_SIZE) {
		chunks.push(String.fromCharCode.apply(null, array.subarray(i, i + CHUNK_SIZE)));
	}

	return chunks.join("");
}

function isUTF8Array(data: Uint8Array, debug?: boolean) {
	for (let i = 0; i < data.length; i++) {
		const b0 = data[i];

		/**
		 * Matches a 1 byte sequence
		 *
		 *    b0
		 * 0xxxxxxx
		 *   0x80 - 128
		 *
		 * (ascii chars)
		 */

		if ((b0 & 0x80) === 0x00) {
			continue;
		}

		/**
		 * Matches a 2 bytes sequence:
		 *
		 *    b0       b1
		 * 110xxxxx 10xxxxxx
		 *   0xC0     0x80
		 *
		 * (includes latin1 chars)
		 */

		if ((b0 & 0xe0) === 0xc0 && i < data.length - 1) {
			const b1 = data[++i];

			if (isByte128(b1)) {
				continue;
			}

			if (debug) {
				console.debug(
					`invalid utf8 sequence: 0x${b0.toString(16)}${b1.toString(16)} [${i - 1}] mask: 0xe0c0`,
				);
			}

			return false;
		}

		/**
		 * Matches a 3 bytes sequence:
		 *
		 *    b0       b1       b2
		 * 1110xxxx 10xxxxxx 10xxxxxx
		 *   0xE0     0x80     0x80
		 */

		if ((b0 & 0xf0) === 0xe0 && i < data.length - 2) {
			const b1 = data[++i];
			const b2 = data[++i];

			if (isByte128(b1) && isByte128(b2)) {
				continue;
			}

			if (debug) {
				console.debug(
					`invalid utf8 sequence: 0x${b0.toString(16)}${b1.toString(16)}${b2.toString(16)} [${
						i - 2
					}] mask: 0xf0c0c0`,
				);
			}

			return false;
		}

		/**
		 * Matches a 4 bytes sequence:
		 *
		 *    b0       b1       b2       b3
		 * 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
		 *   0xF0
		 */

		if ((b0 & 0xf8) === 0xf0 && i < data.length - 3) {
			const b1 = data[++i];
			const b2 = data[++i];
			const b3 = data[++i];

			if (isByte128(b1) && isByte128(b2) && isByte128(b3)) {
				continue;
			}

			if (debug) {
				console.debug(
					`invalid utf8 sequence: 0x${b0.toString(16)}${b1.toString(16)}${b2.toString(
						16,
					)}${b3.toString(16)} [${i - 3}] mask: 0xf8c0c0c0`,
				);
			}

			return false;
		}

		/**
		 * Didn't match. What is this?
		 */

		if (debug) {
			console.debug(`invalid utf8 byte: 0x${b0.toString(16)} [${i}] mask: 0x80`);
		}

		return false;
	}

	return true;
}

/**
 * 2nd to 4th bytes for UTF-8 character requires to be 10xxxxxx (0x80).
 *
 * byte = 1 | x | x | x | x | x | x | x (At least 128)
 * 0xC0 = 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 (D: 192)
 * 0x80 = 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (D: 128)
 *
 * For the specifications, `byte` must be between 0x80 included and 0xC0 excluded (192 - 32 = 160)
 * so that bits 0-6 of `byte` from left, become 0 in the & operation.
 *
 * @param byte
 * @see https://en.wikipedia.org/wiki/UTF-8#Encoding
 * @returns
 */

function isByte128(byte: number): byte is 128 {
	return (byte & 0xc0) === 0x80;
}
