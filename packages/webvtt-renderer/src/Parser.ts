import { CueNode } from "@hsubs/server";
import { Tokenizer } from "./Tokenizer";
import type { Token } from "./Tokenizer";

export interface CueData {
	cueid: string;
	starttime: string;
	endtime: string;
	attributes: any;
	text: string;
}

export function parseCue(data: CueData): CueNode[] {
	const { starttime, endtime, text } = data;

	const startTimeMs /**/ = Timestamps.parseMs(starttime);
	const endTimeMs /****/ = Timestamps.parseMs(endtime);

	const tokenizer = new Tokenizer(text);
	let token: Token = null;

	while ((token = tokenizer.nextToken())) {
		/** @TODO Do something with tokens */

		console.log(token);

		// Resetting the token for the next one
		token = null;
	}

	// return [
	// 	{
	// 		startTime: startTimeMs,
	// 		endTime: endTimeMs,
	// 		content: cueData.text,
	// 		entities: undefined,
	// 		id: cueData.cueid,
	// 		styles: undefined,
	// 	},
	// ];

	return [];
}

namespace Timestamps {
	export function parseMs(timestring: string) {
		const timeMatch = timestring.match(
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
}
