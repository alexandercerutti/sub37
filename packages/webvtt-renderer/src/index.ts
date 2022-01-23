import { HSBaseRenderer } from "@hsubs/base-renderer";
import { CueNode } from "@hsubs/server";

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
				console.log("Found block:", content.substring(block.start, block.cursor + 1));

				const [blockType, parsedContent] = evaluateBlock(content, block.start, block.cursor + 1);

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

					/** @TODO Use Cue or comment somehow */
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

function evaluateBlock(
	content: string,
	start: number,
	end: number,
): [BlockType, unknown /** @TODO change type */] {
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

	const cueParsingResult = parseCue(cueMatch.groups as Parameters<typeof parseCue>[0]);

	return [BlockType.CUE, cueParsingResult];
}

enum CueParsingPhase {
	TAG /**********/ = 0b00001,
	TIMESTAMP /****/ = 0b00010,
	TEXT /*********/ = 0b00100,
}

function parseCue(cueData: {
	cueid: string;
	starttime: string;
	endtime: string;
	attributes: any;
	text: string;
}): CueNode[] {
	const TAG_START = "<";
	const TAG_CLOSE = ">";

	const startTimeMs /**/ = parseTimeMs(cueData.starttime);
	const endTimeMs /****/ = parseTimeMs(cueData.endtime);

	const cues: CueNode[] = [];

	/**
	 * @TODO start parsing the text and searching for entities.
	 * Entities are:
	 *
	 * - <c.classname>text</c>
	 * - <i>text</i> <i.loud>Yellow!</i>
	 * - <b>text</b> <b.loud>Yellow!</b>
	 * - <u>text</u> <u.loud>Yellow!</u>
	 * - <ruby>text</ruby> <ruby.loud>Yellow! <rt.loud>Yellow!</rt></ruby>
	 * - <v Bob>text</v> <v.loud Kathryn>Yellow!</v>
	 * - <lang en-GB>Cyan!</lang> <lang.loud en>Yellow!</lang>
	 * - Timestamps "Like a <00:19.000>big-a <00:19.500>pizza <00:20.000>pie"
	 */

	let textContent = "";
	let cursor = 0;
	let parsingPhase: CueParsingPhase = CueParsingPhase.TEXT;

	while (cursor <= cueData.text.length) {
		if (cueData.text[cursor] == TAG_START) {
			/** Start Token */
			if (Number.isNaN(cueData.text[cursor + 1])) {
				/** Definitely not a timestamp */
				parsingPhase = CueParsingPhase.TAG;
			} else {
				parsingPhase = CueParsingPhase.TIMESTAMP;
			}
		} else if (cueData.text[cursor] === TAG_CLOSE) {
			parsingPhase = CueParsingPhase.TEXT;
			cursor++;
		}

		if (parsingPhase & (CueParsingPhase.TIMESTAMP | CueParsingPhase.TAG)) {
		} else {
			textContent += cueData.text[cursor];
		}

		cursor++;
	}

	return [
		{
			startTime: startTimeMs,
			endTime: endTimeMs,
			content: cueData.text,
			entities: undefined,
			id: cueData.cueid,
			styles: undefined,
		},
	];
}

function parseCueTimestamp(content: string, offset: number) {}

function parseCueEntity(content: string, cursorPoint: number) {
	/** Should we implement something like a state machine that navigates in characters? */
	const markers = [
		["v"],
		["r", "u", "b", "y"],
		["r", "t"],
		["b"],
		["u"],
		["c"],
		["l", "a", "n", "g"],
	];

	const entityBuffer = "";
}

function parseTimeMs(timestring: string) {
	var timeMatch = timestring.match(
		/(?<hours>(\d{2})?):?(?<minutes>(\d{2})):(?<seconds>(\d{2}))(?:\.(?<milliseconds>(\d{0,3})))?/,
	);

	if (!timeMatch) {
		throw new Error("Time format is not valid. Ignoring cue.");
	}

	const {
		groups: { hours, minutes, seconds, milliseconds },
	} = timeMatch;

	const hoursInSeconds = parseIntFallback(hours) * 60 * 60;
	const minutesInSeconds = parseIntFallback(minutes) * 60;
	const parsedSeconds = parseIntFallback(seconds);
	const parsedMs = parseIntFallback(milliseconds) / 1000;

	return (hoursInSeconds + minutesInSeconds + parsedSeconds + parsedMs) * 1000;
}

function parseIntFallback(string: string) {
	return parseInt(string) || 0;
}
