import {
	FRACTION_REGEX,
	FRAMES_REGEX,
	HOURS_REGEX,
	MINUTES_REGEX,
	SECONDS_REGEX,
	SUBFRAMES_REGEX,
} from "../../Units/time.js";

/**
 * hours ":" minutes ":" seconds ( fraction | ":" frames ( "." sub-frames )? )?
 */
const CLOCK_TIME_REGEX = new RegExp(
	`(${HOURS_REGEX.source}):(${MINUTES_REGEX.source}):(${SECONDS_REGEX.source})(?:${FRACTION_REGEX.source}|:(${FRAMES_REGEX.source})(?:\\.(${SUBFRAMES_REGEX.source}))?)?`,
);

export type ClockTimeMatch = [
	hours: number,
	minutes: number,
	seconds: number,
	frames?: number,
	subframes?: number,
];

function toClockTimeMatch(match: RegExpMatchArray): ClockTimeMatch {
	const [, hours, minutes, seconds, fraction, frames, subframes] = match;

	return [
		parseInt(hours) || 0,
		parseInt(minutes) || 0,
		parseFloat(`${seconds || ""}.${fraction}`) || 0,
		parseInt(frames) || undefined,
		parseInt(subframes) || undefined,
	];
}

export function matchClockTimeExpression(content: string): ClockTimeMatch | null {
	let match: RegExpMatchArray | null = null;

	if (!(match = content.match(CLOCK_TIME_REGEX))) {
		return null;
	}

	return toClockTimeMatch(match);
}
