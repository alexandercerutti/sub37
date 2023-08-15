import {
	FRACTION_REGEX,
	FRAMES_REGEX,
	HOURS_REGEX,
	MINUTES_REGEX,
	SECONDS_REGEX,
	SUBFRAMES_REGEX,
} from "../TimeUnits.js";

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
	fraction: number,
	frames: number,
	subframes: number,
];

function toClockTimeMatch(match: RegExpMatchArray): ClockTimeMatch {
	const [, hours, minutes, seconds, fraction, frames, subframes] = match;

	return [
		parseInt(hours),
		parseInt(minutes),
		parseInt(seconds),
		parseInt(fraction),
		parseInt(frames),
		parseInt(subframes),
	];
}

export function matchClockTimeExpression(content: string): ClockTimeMatch | null {
	let match: RegExpMatchArray | null = null;

	if (!(match = content.match(CLOCK_TIME_REGEX))) {
		return null;
	}

	return toClockTimeMatch(match);
}
