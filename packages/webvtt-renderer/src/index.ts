import { HSBaseRenderer } from "@hsubs/base-renderer";
import { CueNode } from "@hsubs/server";
import { CueData, parseCue } from "./parser";

const LF_REGEX = /\n/;
const WEBVTT_HEADER_SECTION = /^(?:[\uFEFF\n\s]*)?WEBVTT(?:\n(.+))?/;
const BLOCK_MATCH_REGEX = /(?<blocktype>(?:REGION|STYLE|NOTE))[\s\r\n]*/;
const REGION_ATTRIBUTES_REGEX = /(?:(?<key>[^\s]+):(?<value>[^\s]+))(?:(?:[\r\n]+)|\s+)/g;
const CUE_MATCH_REGEX =
	/(?:(?<cueid>\d{1,})[\r\n]+)?(?<starttime>(?:\d\d:?){3}\.\d{3})\s-->\s(?<endtime>(?:\d\d:?){3}(?:\.\d{3}))\s*?(?:(?<attributes>[^\r\n]*?))[\r\n]+(?<text>(?:.+[\r\n]*)+)/;

/**
 * @see https://www.w3.org/TR/webvtt1/#file-structure
 */

enum BlockType {
	IGNORED /***/ = 0b0000,
	HEADER /****/ = 0b0001,
	REGION /****/ = 0b0010,
	STYLE /*****/ = 0b0100,
	CUE /*******/ = 0b1000,
}

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
		 * Phase indicator to ignore unordered blocks.
		 * Standard expects header (WEBVTT, STYLE, REGION, COMMENTS)
		 * and then only CUES and COMMENTS.
		 */

		let latestBlockPhase = BlockType.HEADER;

		const REGION_OR_STYLE = BlockType.REGION | BlockType.STYLE;

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
				console.log("Found block:", content.substring(block.start, block.cursor));

				const [blockType, parsedContent] = evaluateBlock(content, block.start, block.cursor);

				const isRegionOrStyle = blockType & REGION_OR_STYLE;
				const isNonCueAllowed = latestBlockPhase & (REGION_OR_STYLE | BlockType.HEADER);

				if (isRegionOrStyle && isNonCueAllowed) {
					/**
					 * If we are not parsing yet cues,
					 * we can save region and styles.
					 * Otherwise ignore.
					 */

					latestBlockPhase = blockType;

					/** @TODO Use Region or Style */
				}

				if (blockType & BlockType.CUE) {
					latestBlockPhase = blockType;
					cues.push(...(parsedContent as CueNode[]));

					/** @TODO Use Cue or comment somehow */
					/** @TODO Link with styled */
					/** @TODO Link with associated regions */
				}

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

function evaluateBlock(content: string, start: number, end: number): [BlockType, unknown] {
	if (start === 0) {
		/** Parsing Headers */
		if (!WEBVTT_HEADER_SECTION.test(content)) {
			throw new Error("Invalid WebVTT file. It should start with string 'WEBVTT'");
		}

		return [BlockType.HEADER, undefined];
	}

	const contentSection = content.substring(start, end);
	const blockMatch = contentSection.match(BLOCK_MATCH_REGEX);

	if (blockMatch?.groups["blocktype"]) {
		switch (blockMatch.groups["blocktype"]) {
			case "REGION":
				/** @TODO not supported yet */
				return [BlockType.REGION, undefined];
			case "STYLE":
				/** @TODO not supported yet */
				return [BlockType.STYLE, undefined];
			case "NOTE":
				return [BlockType.IGNORED, undefined];
		}
	}

	const cueMatch = contentSection.match(CUE_MATCH_REGEX);

	if (!cueMatch) {
		console.warn("Unknown entity found in VTT:", contentSection);
		return [BlockType.IGNORED, undefined];
	}

	const cueParsingResult = parseCue(cueMatch.groups as unknown as CueData);

	return [BlockType.CUE, cueParsingResult];
}
