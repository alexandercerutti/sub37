import type { Entities, RenderingModifiers } from "@sub37/server";
import type { Token } from "../Token.js";
import { Tokenizer } from "../Tokenizer.js";
import { TokenType } from "../Token.js";
import * as Tags from "./Tags/index.js";
import * as Timestamps from "./Timestamps.utils.js";
import { WebVTTRenderingModifiers } from "./RenderingModifiers.js";

/** This structure is compliant with the resulting one from Regex groups property */
export interface CueRawData {
	cueid: string;
	starttime: string;
	endtime: string;
	attributes: string;
	text: string;
}

export interface CueParsedData {
	id?: string;
	startTime: number;
	endTime: number;
	regionName?: string;
	tags: Entities.TagEntity[];
	text: string;
	renderingModifiers: RenderingModifiers;
}

export function parseCue(data: CueRawData): CueParsedData[] {
	const { starttime, endtime, text } = data;

	const hsCues: CueParsedData[] = [];
	const tokenizer = new Tokenizer(text);

	let token: Token = null;
	let currentCue = createCue(
		Timestamps.parseMs(starttime),
		Timestamps.parseMs(endtime),
		data.cueid,
		WebVTTRenderingModifiers.fromString(data.attributes),
	);

	const openTagsQueue = new Tags.NodeQueue();

	while ((token = tokenizer.nextToken())) {
		switch (token.type) {
			case TokenType.START_TAG: {
				openTagsQueue.push(new Tags.Node(currentCue.text.length, token));

				if (!isCueDataTextEmpty(currentCue)) {
					hsCues.push(currentCue);
					currentCue = createCue(
						currentCue.startTime,
						currentCue.endTime,
						currentCue.id,
						currentCue.renderingModifiers,
					);
				}

				addCueEntities(currentCue, Tags.createTagEntitiesFromUnpaired(openTagsQueue, currentCue));
				break;
			}

			case TokenType.END_TAG: {
				if (openTagsQueue.length) {
					if (!openTagsQueue.current) {
						break;
					}

					/**
					 * <ruby> is expected to contain nothing but text and <rt>.
					 * Can we be safe about popping twice, one for rt and one for ruby later?
					 */

					if (token.content === "ruby" && openTagsQueue.current.token.content === "rt") {
						const out = openTagsQueue.pop();
						addCueEntities(currentCue, [Tags.createTagEntity(currentCue, out)]);
					}

					if (openTagsQueue.current.token.content === token.content) {
						openTagsQueue.pop();
					}
				}

				if (!isCueDataTextEmpty(currentCue)) {
					hsCues.push(currentCue);
					currentCue = createCue(
						currentCue.startTime,
						currentCue.endTime,
						currentCue.id,
						currentCue.renderingModifiers,
					);

					addCueEntities(currentCue, Tags.createTagEntitiesFromUnpaired(openTagsQueue, currentCue));
				}

				break;
			}

			case TokenType.STRING: {
				if (!currentCue.text.length && Tokenizer.isWhitespace(token.content)) {
					break;
				}

				currentCue.text += token.content;
				break;
			}

			case TokenType.TIMESTAMP: {
				/**
				 * If current cue has no content, we can safely ignore it.
				 * Next cues will be the timestamped ones.
				 */

				if (!isCueDataTextEmpty(currentCue)) {
					/**
					 * Closing the current entities for the previous cue,
					 * still without resetting open tags, because timestamps
					 * actually belong to the same "logic" cue, so we might
					 * have some tags still open
					 */

					addCueEntities(currentCue, Tags.createTagEntitiesFromUnpaired(openTagsQueue, currentCue));
					hsCues.push(currentCue);
				}

				currentCue = createCue(
					Timestamps.parseMs(token.content),
					currentCue.endTime,
					currentCue.id,
					currentCue.renderingModifiers,
				);
				addCueEntities(currentCue, Tags.createTagEntitiesFromUnpaired(openTagsQueue, currentCue));

				break;
			}

			default:
				break;
		}

		// Resetting the token for the next one
		token = null;
	}

	/**
	 * For the last token... hip hip, hooray!
	 * Jk, we need to close the yet-opened
	 * tags and create entities for them.
	 */

	addCueEntities(currentCue, Tags.createTagEntitiesFromUnpaired(openTagsQueue, currentCue));

	if (!isCueDataTextEmpty(currentCue)) {
		hsCues.push(currentCue);
	}

	return hsCues;
}

function addCueEntities(cue: CueParsedData, entities: Entities.TagEntity[]) {
	for (const entity of entities) {
		if (!cue.tags.length || !cue.tags.find((t) => t.tagType === entity.tagType)) {
			cue.tags.push(entity);
		}
	}
}

function createCue(
	startTime: number,
	endTime: number,
	id?: string,
	renderingModifiers?: RenderingModifiers,
): CueParsedData {
	return {
		startTime,
		endTime,
		text: "",
		tags: [],
		id,
		renderingModifiers,
	};
}

const EMPTY_STRING_REGEX = /\x0A|\x09|\x20|\x0C|/;

function isCueDataTextEmpty(cue: CueParsedData): boolean {
	return !cue.text.length || !cue.text.replace(EMPTY_STRING_REGEX, "").length;
}
