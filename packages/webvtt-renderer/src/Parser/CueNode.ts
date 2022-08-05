import type { Token } from "../Token.js";
import { Tokenizer } from "../Tokenizer.js";
import { TokenType } from "../Token.js";
import * as Tags from "./Tags/index.js";
import * as Timestamps from "./Timestamps.utils.js";

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
	tags: Tags.TagEntityMap;
	text: string;
	attributes: Attributes;
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
		parseAttributes(data.attributes),
	);

	const openTagsTree = new Tags.NodeTree();

	while ((token = tokenizer.nextToken())) {
		switch (token.type) {
			case TokenType.START_TAG: {
				if (Tags.isSupported(token.content)) {
					openTagsTree.push(new Tags.Node(currentCue.text.length, token));
				}

				break;
			}

			case TokenType.END_TAG: {
				if (Tags.isSupported(token.content) && openTagsTree.length) {
					if (!openTagsTree.current) {
						break;
					}

					/**
					 * <ruby> is expected to contain nothing but text and <rt>.
					 * Can we be safe about popping twice, one for rt and one for ruby later?
					 */

					if (token.content === "ruby" && openTagsTree.current.token.content === "rt") {
						const out = openTagsTree.pop();
						currentCue.tags.set(...Tags.createTagEntity(currentCue, out));
					}

					if (openTagsTree.current.token.content === token.content) {
						const out = openTagsTree.pop();
						currentCue.tags.set(...Tags.createTagEntity(currentCue, out));
					}
				}

				break;
			}

			case TokenType.STRING: {
				currentCue.text += token.content;
				break;
			}

			case TokenType.TIMESTAMP: {
				/**
				 * If current cue has no content, we can safely ignore it.
				 * Next cues will be the timestamped ones.
				 */

				if (currentCue.text.length) {
					/**
					 * Closing the current entities for the previous cue,
					 * still without resetting open tags, because timestamps
					 * actually belong to the same "logic" cue, so we might
					 * have some tags still open
					 */

					addCueEntities(currentCue, Tags.createTagEntitiesFromUnpaired(openTagsTree, currentCue));
					hsCues.push(currentCue);
				}

				currentCue = createCue(
					Timestamps.parseMs(token.content),
					currentCue.endTime,
					currentCue.id,
					currentCue.attributes,
				);

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

	addCueEntities(currentCue, Tags.createTagEntitiesFromUnpaired(openTagsTree, currentCue));

	if (currentCue.text.length) {
		hsCues.push(currentCue);
	}

	return hsCues;
}

function addCueEntities(cue: CueParsedData, entities: Tags.TagEntityEntry[]) {
	for (const entity of entities) {
		cue.tags.set(...entity);
	}
}

function createCue(
	startTime: number,
	endTime: number,
	id?: string,
	attributes?: Attributes,
): CueParsedData {
	return {
		startTime,
		endTime,
		text: "",
		tags: new Map() as Tags.TagEntityMap,
		id,
		attributes,
	};
}

interface Attributes {
	position?: string;
	positionAlign?: "line-left" | "center" | "line-right" | "auto";
	line?: string;
	align?: string;
	size?: string;
	region?: string;
	snapToLines?: string;
	vertical?: "" | "rl" | "lr";
	lineAlign?: "start" | "center" | "end";
}

function parseAttributes(attributesLine: string): Attributes {
	if (!attributesLine?.length) {
		return {};
	}

	return attributesLine.split(" ").reduce((acc, curr) => {
		const [key, value] = curr.split(":");
		return (key && value && { ...acc, [key]: value }) || acc;
	}, {});
}
