import { CueNode } from "@hsubs/server";
import { Tokenizer } from "../Tokenizer.js";
import { TokenType } from "../Token.js";
import type { Token } from "../Token.js";
import * as Tags from "./Tags.utils.js";
import * as Timestamps from "./Timestamps.utils.js";

export interface CueData {
	cueid: string;
	starttime: string;
	endtime: string;
	attributes: any;
	text: string;
}

export function parseCue(data: CueData): CueNode[] {
	const { starttime, endtime, text } = data;

	const hsCues: CueNode[] = [];
	const tokenizer = new Tokenizer(text);
	let token: Token = null;
	let currentCue: CueNode = {
		startTime: Timestamps.parseMs(starttime),
		endTime: Timestamps.parseMs(endtime),
		content: "",
		entities: [],
		id: data.cueid,
	};

	const openTags: Tags.OpenTag[] = [];

	while ((token = tokenizer.nextToken())) {
		switch (token.type) {
			case TokenType.START_TAG: {
				if (Tags.isSupported(token.content)) {
					openTags.push({ index: currentCue.content.length, token });
				}

				break;
			}

			case TokenType.END_TAG: {
				if (
					Tags.isSupported(token.content) &&
					openTags.length &&
					openTags[openTags.length - 1].token.content === token.content
				) {
					const openedTag = openTags.pop();
					currentCue.entities.push(Tags.createEntity(currentCue, openedTag));
				}

				break;
			}

			case TokenType.STRING: {
				currentCue.content += token.content;
				break;
			}

			case TokenType.TIMESTAMP: {
				if (!currentCue.content.length) {
					/** Current cue is the first one. Not need to append a new one */
					break;
				}

				/**
				 * Closing the current entities for the previous cue,
				 * still without resetting open tags, because timestamps
				 * actually belong to the same "logic" cue, so we might
				 * have some tags still open
				 */

				currentCue.entities.push(...Tags.completeMissing(openTags, currentCue));
				hsCues.push(currentCue);

				currentCue = {
					startTime: Timestamps.parseMs(token.content),
					endTime: currentCue.endTime,
					content: "",
					entities: [],
					id: currentCue.id,
				};

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

	currentCue.entities.push(...Tags.completeMissing(openTags, currentCue));

	if (currentCue.content.length) {
		hsCues.push(currentCue);
	}

	return hsCues;
}
