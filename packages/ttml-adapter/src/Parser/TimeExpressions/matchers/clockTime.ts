import {
	FRACTION_REGEX,
	FRAMES_REGEX,
	HOURS_REGEX,
	MINUTES_REGEX,
	SECONDS_REGEX,
	SUBFRAMES_REGEX,
} from "../../Units/time.js";
import type { Unit } from "../../Units/unit";
import { createUnit } from "../../Units/unit.js";

/**
 * hours ":" minutes ":" seconds ( fraction | ":" frames ( "." sub-frames )? )?
 */
const CLOCK_TIME_REGEX = new RegExp(
	`(${HOURS_REGEX.source}):(${MINUTES_REGEX.source}):(${SECONDS_REGEX.source})(?:${FRACTION_REGEX.source}|:(${FRAMES_REGEX.source})(?:\\.(${SUBFRAMES_REGEX.source}))?)?`,
);

export type ClockTimeUnit = [
	Unit<"hours">,
	Unit<"minutes">,
	Unit<"seconds">,
	Unit<"frames">,
	Unit<"subframes">,
];

type MatchedClockTime = RegExpMatchArray &
	[
		unknown,
		hours: string,
		minutes: string,
		seconds: string,
		fraction: string | undefined,
		frames: string | undefined,
		subframes: string | undefined,
	];

function createClockTimeUnit(match: MatchedClockTime): ClockTimeUnit {
	const [, hours, minutes, seconds, fraction, frames, subframes] = match;

	return [
		createUnit(parseInt(hours) || 0, "hours"),
		createUnit(parseInt(minutes) || 0, "minutes"),
		createUnit(parseFloat(`${seconds || ""}.${fraction}`) || 0, "seconds"),
		createUnit(parseInt(frames ?? "0"), "frames"),
		createUnit(parseInt(subframes ?? "0"), "subframes"),
	];
}

function matchedClockTimeExpression(match: RegExpMatchArray | null): match is MatchedClockTime {
	return match !== null;
}

export function matchClockTimeExpression(content: string): ClockTimeUnit | null {
	const match = content.match(CLOCK_TIME_REGEX);

	if (!matchedClockTimeExpression(match)) {
		return null;
	}

	return createClockTimeUnit(match);
}
