import { HSBaseRenderer } from "@hsubs/base-renderer";
import { CueNode } from "@hsubs/server";

const LF_REGEX = /\n/;
const WEBVTT_HEADER_SECTION = /^(?:[\uFEFF\n]*)?WEBVTT(?:\n(.+))?/;
const BLOCK_MATCH_REGEX = /(?<blocktype>(?:REGION|STYLE|NOTE)\s*)/;
const REGION_ATTRIBUTES_REGEX = /(?:(?<key>[^\s]+):(?<value>[^\s]+))(?:(?:[\r\n]+)|\s+)/g;
const CUE_MATCH_REGEX =
	/(?:(?<cueid>\d{1,})[\r\n]+)?(?<starttime>(?:\d\d:?){3}\.\d{3})\s-->\s(?<endtime>(?:\d\d:?){3}(?:\.\d{3}))(?<attributes>.+)?[\r\n]+(?<text>(?:.+[\r\n]*)+)/;

export class WebVTTRenderer extends HSBaseRenderer {
	static override get supportedType() {
		return "text/vtt";
	}

	override parse(rawContent: string): CueNode[] {
		const cues: CueNode[] = [];
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

		evalutateHeaders(content.substring(block.start, block.cursor + 1));

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

				evalutateBlock(content.substring(block.start, block.cursor + 1));

				/** Skipping \n\n and going to the next character */
				block.cursor += 3;
				block.start = block.cursor - 1;
			} else {
				block.cursor += 1;
			}
		} while (block.cursor <= content.length);

		/** Evaluating the last block found */
		evalutateBlock(content.substring(block.start, block.cursor + 1));

		return cues;
	}
}

function evalutateHeaders(content: string) {
	if (!WEBVTT_HEADER_SECTION.test(content)) {
		throw new Error("Invalid WebVTT file. It should start with string 'WEBVTT'");
	}
}

function evalutateBlock(content: string) {
	const blockMatch = content.match(BLOCK_MATCH_REGEX);

	if (blockMatch && blockMatch.groups["blockType"]) {
		switch (blockMatch.groups["blockType"]) {
			case "REGION":
				/** @TODO not supported yet */
				return;
			case "STYLE":
				/** @TODO not supported yet */
				return;
			case "NOTE":
				return;
		}
	}

	const cueMatch = content.match(CUE_MATCH_REGEX);

	if (cueMatch !== null) {
		return createVTTCueFromCueMatch(cueMatch, availableRegions);
	}
}
