import type { Region } from "@sub37/server";
import { BaseAdapter, CueNode, Entities } from "@sub37/server";
import { InvalidFormatError } from "./InvalidFormatError.js";
import { MissingContentError } from "./MissingContentError.js";
import * as Parser from "./Parser/index.js";

const WEBVTT_HEADER_SECTION = /^(?:[\uFEFF\n\s]*)?WEBVTT(?:\n(.+))?/;
const BLOCK_MATCH_REGEX = /(?<blocktype>(?:REGION|STYLE|NOTE))[\s\r\n]*(?<payload>[\w\W]*)/;
const CUE_MATCH_REGEX =
	/(?:(?<cueid>[^\n\t]*)\s+)?(?<starttime>(?:(?:\d\d:)?(?:\d\d:)(?:\d\d)\.\d{3}))\s-->\s(?<endtime>(?:(?:\d\d:)?(?:\d\d:)(?:\d\d)\.\d{3}))\s*?(?:(?<attributes>[^\r\n]*?)\s*)[\r\n]+\s*(?<text>(?:.+\s*)+)/;
const TABS_REGEX = /\t+/g;

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

export default class WebVTTAdapter extends BaseAdapter {
	static override get supportedType() {
		return "text/vtt";
	}

	override parse(rawContent: string): BaseAdapter.ParseResult {
		if (!rawContent) {
			return BaseAdapter.ParseResult(undefined, [
				{
					error: new MissingContentError(),
					failedChunk: "",
					isCritical: true,
				},
			]);
		}

		const cues: CueNode[] = [];
		const content = String(rawContent).replace(/\r?\n/g, "\n");
		const block = {
			start: 0,
			cursor: 0,
		};

		const regions: { [id: string]: Region } = Object.create(null);
		const styles: Parser.Style[] = [];

		const failures: BaseAdapter.ParseError[] = [];

		/**
		 * Phase indicator to ignore unordered blocks.
		 * Standard expects header (WEBVTT, STYLE, REGION, COMMENTS)
		 * and then only CUES and COMMENTS.
		 */

		let latestBlockPhase = BlockType.HEADER;

		do {
			/**
			 * Checking if the current character is a newline linefeed indicator (\n) and if the next one is so.
			 * If so, we ended the block. The same if we reached the string end.
			 */

			if (
				(content[block.cursor] !== "\n" || content[block.cursor + 1] !== "\n") &&
				block.cursor !== content.length
			) {
				block.cursor += 1;
				continue;
			}

			try {
				const blockEvaluationResult = evaluateBlock(content, block.start, block.cursor);

				if (isError(blockEvaluationResult)) {
					failures.push({
						error: blockEvaluationResult,
						failedChunk: content.substring(block.start, block.cursor),
						isCritical: false,
					});

					/** Skipping \n\n and going to the next character */
					block.cursor += 3;
					block.start = block.cursor - 1;

					continue;
				}

				/**
				 * According to WebVTT standard, Region and style blocks should be
				 * placed above the cues. So we try to ignore them if they are mixed.
				 */

				const shouldProcessNonCues =
					latestBlockPhase & (BlockType.REGION | BlockType.STYLE | BlockType.HEADER);

				if (isRegion(blockEvaluationResult) && shouldProcessNonCues) {
					const [blockType, parsedContent] = blockEvaluationResult;

					if (parsedContent?.id) {
						latestBlockPhase = blockType;
						regions[parsedContent.id] = parsedContent;
					}
				}

				if (isStyle(blockEvaluationResult) && shouldProcessNonCues) {
					const [blockType, parsedContent] = blockEvaluationResult;
					latestBlockPhase = blockType;
					styles.push(parsedContent);
				}

				if (isCue(blockEvaluationResult)) {
					const [blockType, parsedContent] = blockEvaluationResult;
					latestBlockPhase = blockType;

					/**
					 * Saving the first cue with the id of the next cues
					 * so we can inherit the different properties and
					 * always have a reference to the cue timelines cues
					 * origin from.
					 */

					let latestRootCue: CueNode | undefined = undefined;

					for (const parsedCue of parsedContent) {
						if (parsedCue.startTime >= parsedCue.endTime) {
							continue;
						}

						const cue = CueNode.from(latestRootCue, {
							id: parsedCue.id,
							startTime: parsedCue.startTime,
							endTime: parsedCue.endTime,
							content: parsedCue.text,
							renderingModifiers: parsedCue.renderingModifiers,
						});

						if (parsedCue.renderingModifiers.regionIdentifier) {
							cue.region = regions[parsedCue.renderingModifiers.regionIdentifier];
						}

						if (!latestRootCue) {
							latestRootCue = cue;
						}

						const stylesEntities = styles
							.filter((style) => {
								return (
									(style.type === Parser.StyleDomain.ID && style.selector === parsedCue.id) ||
									style.type === Parser.StyleDomain.GLOBAL
								);
							})
							.sort(styleSpecificitySorter);

						const entities: Entities.Tag[] = [];

						if (stylesEntities.length) {
							entities.push(
								new Entities.Tag({
									tagType: Entities.TagType.SPAN,
									attributes: new Map(),
									classes: [],
								}),
							);

							for (let style of stylesEntities) {
								entities[0].setStyles(style.styleString);
							}
						}

						for (const tag of parsedCue.tags) {
							entities.push(tag);

							stylesLoop: for (const style of styles) {
								if (style.type !== Parser.StyleDomain.TAG) {
									continue;
								}

								if (style.tagName && style.tagName !== tag.tagType) {
									continue;
								}

								if (style.attributes.size > tag.attributes.size) {
									continue;
								}

								if (style.attributes.size && tag.attributes.size) {
									for (const [key, value] of tag.attributes) {
										const styleAttributeValue = style.attributes.get(key);

										if (styleAttributeValue === null) {
											continue stylesLoop;
										}

										if (styleAttributeValue && styleAttributeValue !== value) {
											continue stylesLoop;
										}
									}
								}

								if (style.classes.length !== tag.classes.length) {
									continue;
								}

								for (const className of tag.classes) {
									if (!style.classes.includes(className)) {
										continue stylesLoop;
									}
								}

								tag.setStyles(style.styleString);
							}
						}

						cue.entities = entities;
						cues.push(cue);
					}
				}

				/** Skipping \n\n and going to the next character */
				block.cursor += 3;
				block.start = block.cursor - 1;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(JSON.stringify(err));

				return BaseAdapter.ParseResult(undefined, [
					{
						error,
						isCritical: true,
						failedChunk: undefined,
					},
				]);
			}
		} while (block.cursor <= content.length);

		return BaseAdapter.ParseResult(cues, failures);
	}
}

type CueBlockTuple = [blockType: BlockType.CUE, payload: Parser.CueParsedData[]];
type HeaderBlockTuple = [blockType: BlockType.HEADER, payload: undefined];
type RegionBlockTuple = [blockType: BlockType.REGION, payload: Region];
type StyleBlockTuple = [blockType: BlockType.STYLE, payload: Parser.Style];
type IgnoredBlockTuple = [blockType: BlockType.IGNORED, payload: undefined];

type BlockTuple =
	| CueBlockTuple
	| HeaderBlockTuple
	| RegionBlockTuple
	| StyleBlockTuple
	| IgnoredBlockTuple;

function evaluateBlock(
	content: string,
	start: number,
	end: number,
): BlockTuple | InvalidFormatError {
	if (start === 0) {
		/** Parsing Headers */
		if (!WEBVTT_HEADER_SECTION.test(content)) {
			throw new InvalidFormatError("WEBVTT_HEADER_MISSING", content.substring(start, end));
		}

		return [BlockType.HEADER, undefined];
	}

	const contentSection = content.substring(start, end);
	const blockMatch = contentSection.match(BLOCK_MATCH_REGEX);

	if (blockMatch?.groups["blocktype"]) {
		switch (blockMatch.groups["blocktype"]) {
			case "REGION": {
				const payload = Parser.parseRegion(blockMatch.groups["payload"]);
				return [BlockType.REGION, payload];
			}

			case "STYLE": {
				const payload = Parser.parseStyle(blockMatch.groups["payload"]);
				return [BlockType.STYLE, payload];
			}

			case "NOTE": {
				return [BlockType.IGNORED, undefined];
			}
		}
	}

	const cueMatch = contentSection.match(CUE_MATCH_REGEX);

	if (!cueMatch) {
		return new InvalidFormatError("UNKNOWN_BLOCK_ENTITY", contentSection);
	}

	const { attributes, cueid, endtime, starttime, text } = cueMatch.groups as {
		[K in keyof Parser.CueRawData]: Parser.CueRawData[K];
	};

	const cueParsingResult = Parser.parseCue({
		attributes,
		cueid: cueid || `cue-${start}-${end}`,
		endtime,
		starttime,
		text: text.replace(TABS_REGEX, ""),
	});

	return [BlockType.CUE, cueParsingResult];
}

function isRegion(evalutation: BlockTuple): evalutation is RegionBlockTuple {
	return Boolean(evalutation[0] & BlockType.REGION);
}

function isStyle(evalutation: BlockTuple): evalutation is StyleBlockTuple {
	return Boolean(evalutation[0] & BlockType.STYLE);
}

function isCue(evaluation: BlockTuple): evaluation is CueBlockTuple {
	return Boolean(evaluation[0] & BlockType.CUE);
}

/**
 * If the content is not a critical error, it will be returned as-is.
 * If it is critical, it will be thrown
 *
 * @param evaluation
 * @returns
 */

function isError(evaluation: BlockTuple | Error): evaluation is Error {
	return !Array.isArray(evaluation) && evaluation instanceof Error;
}

/**
 * Reorders styles so that Global styles are placed
 * before id styles
 *
 * @param s1
 * @param s2
 * @returns
 */

function styleSpecificitySorter(s1: Parser.Style, s2: Parser.Style) {
	if (s1.type === s2.type) {
		return 0;
	}

	if (s1.type === Parser.StyleDomain.ID && s2.type === Parser.StyleDomain.GLOBAL) {
		return 1;
	}

	return -1;
}
