import { HSBaseRenderer } from "@hsubs/base-renderer";
import { CueNode } from "@hsubs/server";

const LF_REGEX = /\n/;
const WEBVTT_HEADER_SECTION = /^(?:[\uFEFF\n\s]*)?WEBVTT(?:\n(.+))?/;
const BLOCK_MATCH_REGEX = /(?<blocktype>(?:REGION|STYLE|NOTE))[\s\r\n]*/;
const REGION_ATTRIBUTES_REGEX = /(?:(?<key>[^\s]+):(?<value>[^\s]+))(?:(?:[\r\n]+)|\s+)/g;
const CUE_MATCH_REGEX =
	/(?:(?<cueid>\d{1,})[\r\n]+)?(?<starttime>(?:\d\d:?){3}\.\d{3})\s-->\s(?<endtime>(?:\d\d:?){3}(?:\.\d{3}))(?<attributes>.+)?[\r\n]+(?<text>(?:.+[\r\n]*)+)/;

export class WebVTTRenderer extends HSBaseRenderer {
	static override get supportedType() {
		return "text/vtt";
	}

	override parse(rawContent: string): CueNode[] {
		if (!rawContent) {
			return [];
		}

		const cues: CueNode[] = [];
		const content = rawContent.replace(/\r?\n/g, "\n");
		const block = {
			start: 0,
			cursor: 0,
		};

		/**
		 * Navigating body
		 */

		do {
			/**
			 * Checking if the current character is a newline linefeed indicator (\n) and if the next one is so.
			 * If so, we ended the block. The same if we reached the string end.
			 */

			if (
				(LF_REGEX.test(content[block.cursor]) && LF_REGEX.test(content[block.cursor + 1])) ||
				block.cursor === content.length
			) {
				console.log("Found block:", content.substring(block.start, block.cursor + 1));

				evalutateBlock(content, block.start, block.cursor + 1);

				/** Skipping \n\n and going to the next character */
				block.cursor += 3;
				block.start = block.cursor - 1;
			} else {
				block.cursor += 1;
			}
		} while (block.cursor <= content.length);

		return cues;
	}
}

function evalutateBlock(content: string, start: number, end: number) {
	if (start === 0) {
		/** Parsing Headers */
		if (!WEBVTT_HEADER_SECTION.test(content)) {
			throw new Error("Invalid WebVTT file. It should start with string 'WEBVTT'");
		}

		return;
	}

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
