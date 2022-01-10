import { HSBaseRenderer } from "@hsubs/base-renderer";
import { CueNode } from "@hsubs/server";

const LF_REGEX = /\n/;
const WEBVTT_HEADER_SECTION = /^\n*WEBVTT(?:\n(.+))?/;

export class WebVTTRenderer extends HSBaseRenderer {
	static override get supportedType() {
		return "text/vtt";
	}

	override parse(rawContent: string): CueNode[] {
		const content = rawContent.replace(/\r?\n/g, "\n");
		const block = {
			start: 0,
			cursor: 0,
		};

		/**
		 * Navigating headers
		 */

		do {
			block.cursor += 1;
		} while (!LF_REGEX.test(content[block.cursor]) && !LF_REGEX.test(content[block.cursor + 1]));

		parseWebVTTHeaders(content.substring(block.start, block.cursor + 1));

		block.cursor += 3;
		block.start = block.cursor - 1;

		/**
		 * Navigating body
		 */

		do {
			/**
			 * Checking if the current character is a newline linefeed indicator (\n) and if the next one is so.
			 * If so, we ended the block. The same if we reached the string end.
			 */

			if (LF_REGEX.test(content[block.cursor]) && LF_REGEX.test(content[block.cursor + 1])) {
				console.log("Found block:", content.substring(block.start, block.cursor + 1));

				/** Skipping \n\n and going to the next character */
				block.cursor += 3;
				block.start = block.cursor - 1;
			} else {
				block.cursor += 1;
			}
		} while (block.cursor <= content.length);

		/** @TODO evaluate the last block cursor + 1 */

		return [];
	}
}

function parseWebVTTHeaders(content: string) {
	if (!WEBVTT_HEADER_SECTION.test(content)) {
		throw new Error("Invalid WebVTT file. It should start with string 'WEBVTT'");
	}
}
