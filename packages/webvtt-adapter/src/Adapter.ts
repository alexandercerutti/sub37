import type { Region } from "@sub37/server";
import { BaseAdapter, CueNode, Entities } from "@sub37/server";
import { EmptyStyleDeclarationError } from "./EmptyStyleDeclarationError.js";
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

		const cueIdsList: Set<string> = new Set();
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

					if (!parsedContent) {
						failures.push({
							error: new EmptyStyleDeclarationError(),
							failedChunk: content.substring(block.start, block.cursor),
							isCritical: false,
						});
					} else {
						styles.push(parsedContent);
					}
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

					/**
					 * @TODO performing a filter and a remap for each parsed cue might be useless
					 */

					const globalStylesEntities = styles
						.filter((style) => style.type === Parser.StyleDomain.GLOBAL)
						.map((style) => Entities.createLineStyleEntity(style.styleString));

					for (const parsedCue of parsedContent) {
						if (parsedCue.startTime >= parsedCue.endTime) {
							failures.push({
								error: new Error(
									`A cue cannot start (${parsedCue.startTime}) after its end time (${parsedCue.endTime})`,
								),
								failedChunk: content.substring(block.start, block.cursor),
								isCritical: false,
							});

							continue;
						}

						if (parsedCue.id) {
							/**
							 * "A WebVTT cue identifier must be unique amongst
							 * all the WebVTT cue identifiers of all WebVTT
							 * cues of a WebVTT file."
							 *
							 * @see https://www.w3.org/TR/webvtt1/#webvtt-cue-identifier
							 */

							if (!parsedCue.groupingIdentifier && cueIdsList.has(parsedCue.id)) {
								failures.push({
									error: new Error(
										`A WebVTT cue identifier must be unique amongst all the cue identifiers of a WebVTT file. Double id found: '${parsedCue.id}'`,
									),
									failedChunk: content.substring(block.start, block.cursor),
									isCritical: false,
								});

								continue;
							}

							/**
							 * ... however, when we generate a custom identifier
							 * for the cue, we re-use the same for the timestamps
							 * because they must appear on the same line.
							 */
							cueIdsList.add(parsedCue.id);
						}

						const cue = CueNode.from(latestRootCue, {
							id: parsedCue.id || `cue-${block.start}-${block.cursor}`,
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

						const stylesById = styles
							.filter(
								(style) => style.type === Parser.StyleDomain.ID && style.selector === parsedCue.id,
							)
							.map((style) => Entities.createLineStyleEntity(style.styleString));

						const entities: Entities.AllEntities[] = [...globalStylesEntities, ...stylesById];

						for (const tag of parsedCue.tags) {
							const originalEntity: Entities.TagEntity = Object.getPrototypeOf(tag);
							entities.push(originalEntity);

							stylesLoop: for (const style of styles) {
								if (style.type !== Parser.StyleDomain.TAG) {
									continue;
								}

								/**
								 * Looking for a matching tag that has the same:
								 *  - tag name
								 *  - number of attributes
								 *  - exact matching attributes
								 *  - classes amount
								 *  - exact matching classes
								 *  - A nice smile :)
								 */

								if (style.tagName && style.tagName !== tag.tagType) {
									continue;
								}

								if (style.attributes.size > tag.attributes.size) {
									continue;
								}

								if (style.attributes.size && tag.attributes.size) {
									for (const [key, value] of tag.attributes) {
										const styleAttributeValue = style.attributes.get(key);

										if (!styleAttributeValue) {
											continue stylesLoop;
										}

										if (
											styleAttributeValue &&
											styleAttributeValue !== value &&
											styleAttributeValue !== "*"
										) {
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

								/**
								 * YAY 🎉 We found a matching tag for a style!
								 */

								entities.push(Entities.createLocalStyleEntity(style.styleString));
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

function evaluateBlock(content: string, start: number, end: number): BlockTuple | Error {
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
				try {
					const payload = Parser.parseStyle(blockMatch.groups["payload"]);
					return [BlockType.STYLE, payload];
				} catch (err) {
					/** Failing gracefully, not critical */
					return err as Error;
				}
			}

			case "NOTE": {
				return [BlockType.IGNORED, undefined];
			}
		}
	}

	const cueMatch = contentSection.match(CUE_MATCH_REGEX);

	if (!cueMatch) {
		/** Failing gracefully, not critical */
		return new InvalidFormatError("UNKNOWN_BLOCK_ENTITY", contentSection);
	}

	type CueMatchGroups = {
		[K in keyof Omit<
			Parser.CueRawData,
			"startCharPosition" | "endCharPosition"
		>]: Parser.CueRawData[K];
	};

	const { attributes, cueid, endtime, starttime, text } = cueMatch.groups as CueMatchGroups;

	const cueParsingResult = Parser.parseCue({
		attributes,
		cueid: cueid,
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
