import { CueNode } from "@hsubs/server";
import { Tokenizer } from "./Tokenizer.js";
import { TokenType } from "./Token.js";
import type { Token } from "./Token.js";

enum VTTEntities {
	VOICE /*******/ = 0b00000001,
	LANG /********/ = 0b00000010,
	RUBY /********/ = 0b00000100,
	RT /**********/ = 0b00001000,
	CLASS /*******/ = 0b00010000,
	BOLD /********/ = 0b00100000,
	ITALIC /******/ = 0b01000000,
	UNDERLINE /***/ = 0b10000000,
}

namespace Tags {
	export type OpenTag = { index: number; token: Token };

	const EntitiesTokenMap: { [key: string]: VTTEntities } = {
		v: VTTEntities.VOICE,
		lang: VTTEntities.LANG,
		ruby: VTTEntities.RUBY,
		rt: VTTEntities.RT,
		c: VTTEntities.CLASS,
		b: VTTEntities.BOLD,
		i: VTTEntities.ITALIC,
		u: VTTEntities.UNDERLINE,
	};

	export function isSupported(content: string): boolean {
		return Boolean(EntitiesTokenMap[content]);
	}

	export function completeMissing(openTags: OpenTag[], currentCue: CueNode) {
		return openTags.map(({ index, token }) => ({
			offset: index,
			length: currentCue.content.length - index,
			type: EntitiesTokenMap[token.content],
		}));
	}
}

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

					currentCue.entities.push({
						offset: openedTag.index,
						length: currentCue.content.length - openedTag.index,
						attributes: [openedTag.token.annotations],
					});
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

				currentCue.content = currentCue.content.trimStart();
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

namespace Timestamps {
	const TIME_REGEX =
		/(?<hours>(\d{2})?):?(?<minutes>(\d{2})):(?<seconds>(\d{2}))(?:\.(?<milliseconds>(\d{0,3})))?/;

	export function parseMs(timestring: string) {
		const timeMatch = timestring.match(TIME_REGEX);

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
}
