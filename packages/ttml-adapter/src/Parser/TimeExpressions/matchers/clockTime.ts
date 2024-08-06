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

function createClockTimeUnit(match: RegExpMatchArray): ClockTimeUnit {
	const [, hours, minutes, seconds, fraction, frames, subframes] = match;

	return [
		createUnit(parseInt(hours) || 0, "hours"),
		createUnit(parseInt(minutes) || 0, "minutes"),
		createUnit(parseFloat(`${seconds || ""}.${fraction}`) || 0, "seconds"),
		createUnit(parseInt(frames) || undefined, "frames"),
		createUnit(parseFloat(`0.${subframes}`) || undefined, "subframes"),
	];
}

export function matchClockTimeExpression(content: string): ClockTimeUnit | null {
	let match: RegExpMatchArray | null = null;

	if (!(match = content.match(CLOCK_TIME_REGEX))) {
		return null;
	}

	return createClockTimeUnit(match);
}
