import { HSBaseRenderer, Region } from "@hsubs/server";
import type { CueNode } from "@hsubs/server";
import * as Parser from "./Parser";

const LF_REGEX = /\n/;
const WEBVTT_HEADER_SECTION = /^(?:[\uFEFF\n\s]*)?WEBVTT(?:\n(.+))?/;
const BLOCK_MATCH_REGEX = /(?<blocktype>(?:REGION|STYLE|NOTE))[\s\r\n]*(?<payload>[\w\W]*)/;
// const REGION_ATTRIBUTES_REGEX = /(?:(?<key>[^\s]+):(?<value>[^\s]+))(?:(?:[\r\n]+)|\s+)/g;
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

export default class Renderer extends HSBaseRenderer {
	static override get supportedType() {
		return "text/vtt";
	}

	override parse(rawContent: string): CueNode[] {
		if (!rawContent) {
			return [];
		}

		const cues: CueNode[] = [];
		const content = String(rawContent).replace(/\r?\n/g, "\n");
		const block = {
			start: 0,
			cursor: 0,
		};

		const regions: Region[] = [];

		/**
		 * Phase indicator to ignore unordered blocks.
		 * Standard expects header (WEBVTT, STYLE, REGION, COMMENTS)
		 * and then only CUES and COMMENTS.
		 */

		let latestBlockPhase = BlockType.HEADER;

		debugger;

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

				const blockEvaluationResult = evaluateBlock(content, block.start, block.cursor, regions);

				/**
				 * According to WebVTT standard, Region and style blocks should be
				 * placed above the cues. So we try to ignore them if they are mixed.
				 */

				const shouldProcessNonCues =
					latestBlockPhase & (BlockType.REGION | BlockType.STYLE | BlockType.HEADER);

				if (isRegion(blockEvaluationResult) && shouldProcessNonCues) {
					const [blockType, parsedContent] = blockEvaluationResult;
					latestBlockPhase = blockType;
					regions.push(parsedContent);
				}

				if (isStyle(blockEvaluationResult) && shouldProcessNonCues) {
					const [blockType, parsedContent] = blockEvaluationResult;
					latestBlockPhase = blockType;

					/** @TODO how do we process and use styles? */
				}

				if (isCue(blockEvaluationResult)) {
					const [blockType, parsedContent] = blockEvaluationResult;

					latestBlockPhase = blockType;

					for (let cue of parsedContent) {
						if (cue.startTime < cue.endTime) {
							cues.push(cue);
						}
					}

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

type CueBlockType = [blockType: BlockType.CUE, payload: CueNode[]];
type HeaderBlockType = [blockType: BlockType.HEADER, payload: undefined];
type RegionBlockType = [blockType: BlockType.REGION, payload: Region];
type StyleBlockType = [blockType: BlockType.STYLE, payload: undefined];
type IgnoredBlockType = [blockType: BlockType.IGNORED, payload: undefined];

type BlockTuple =
	| CueBlockType
	| HeaderBlockType
	| RegionBlockType
	| StyleBlockType
	| IgnoredBlockType;

function evaluateBlock(content: string, start: number, end: number, regions: Region[]): BlockTuple {
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
				const payload = Parser.parseRegion(blockMatch.groups["payload"]);

				if (!payload || regions.find((r) => r.id === payload.id)) {
					return [BlockType.IGNORED, undefined];
				}

				return [BlockType.REGION, payload];
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

	const cueParsingResult = Parser.parseCue(cueMatch.groups as unknown as Parser.CueRawData);

	return [BlockType.CUE, cueParsingResult];
}

function isRegion(evalutation: BlockTuple): evalutation is RegionBlockType {
	return Boolean(evalutation[0] & BlockType.REGION);
}

function isStyle(evalutation: BlockTuple): evalutation is StyleBlockType {
	return Boolean(evalutation[0] & BlockType.STYLE);
}

function isCue(evaluation: BlockTuple): evaluation is CueBlockType {
	return Boolean(evaluation[0] & BlockType.CUE);
}
