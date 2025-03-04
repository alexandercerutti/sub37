import { DATE_REGEX, HHMMSS_TIME_REGEX } from "../../Units/time.js";
import type { Unit } from "../../Units/unit.js";
import { createUnit } from "../../Units/unit.js";

/**
 * Wallclock regexes are ordered by specificity
 * as DATETIME includes WALLTIME and DATE.
 *
 * "wallclock(" <lwsp>? ( date-time | wall-time | date ) \<lwsp>? ")"
 */

/**
 * @definition
 * wallclock(" \<lwsp>? (             date-time            ) \<lwsp>? ")
 * wallclock(" \<lwsp>? ( YYYY-MM-DD T ( HH:MM:SS | HH:MM )) \<lwsp>? ")
 *
 * @testcases
 * wallclock(" 2023-08-13T01:49")
 * wallclock(" 2023-08-13T01:49:13")
 * wallclock(" 2023-08-13T01:49:13.000")
 * wallclock(" 2023-08-13T01:49:13 ")
 */

const WALLCLOCK_DATETIME_REGEX = new RegExp(
	`wallclock\\("\\s*${DATE_REGEX.source}T(?:${HHMMSS_TIME_REGEX.source})\\s*"\\)`,
);

/**
 * @definition
 * wallclock(" \<lwsp>? (       wall-time      ) \<lwsp>? ")
 * wallclock(" \<lwsp>? ( HH:MM | HH:MM:SS.FR? ) \<lwsp>? ")
 *
 * @testcases
 * wallclock("22:10")
 * wallclock(" 22:10:15")
 * wallclock("22:10:15 ")
 * wallclock(" 22:10:15.000")
 */
const WALLCLOCK_WALLTIME_REGEX = new RegExp(`wallclock\\("\\s*${HHMMSS_TIME_REGEX.source}\\s*"\\)`);

/**
 * @definition
 * wallclock(" \<lwsp>? (    date    ) \<lwsp>? ")
 * wallclock(" \<lwsp>? ( YYYY-MM-DD ) \<lwsp>? ")
 *
 * @testcases
 * wallclock("2023-08-13")
 * wallclock(" 2023-08-13")
 * wallclock("2023-08-13 ")
 * wallclock(" 2023-08-13 ")
 */

const WALLCLOCK_DATE_REGEX = new RegExp(`wallclock\\("\\s*${DATE_REGEX.source}\\s*"\\)`);
export type WallClockUnit = Unit<"date">;

function toWallClockWallTimeMatch(
	match: [hours: string, minutes: string, seconds: string, fraction?: string],
): Date {
	const [hours, minutes, seconds, fraction] = match;

	return new Date(
		1970,
		0,
		1,
		parseInt(hours),
		parseInt(minutes),
		parseInt(seconds || "0"),
		parseInt(fraction || "0"),
	);
}

function toWallClockDateMatch(match: [year: string, month: string, day: string]): Date {
	const [year, month, day] = match;

	const paddedMonth = month.padStart(2, "0");
	const paddedDay = day.padStart(2, "0");

	return new Date(`${year}-${paddedMonth}-${paddedDay}T00:00:00`);
}

function createWallClockDateTimeUnit(match: RegExpMatchArray): WallClockUnit {
	const [, year, month, day, hours, minutes, seconds, fraction] = match;

	const summedTimestamps =
		toWallClockDateMatch([year, month, day]).getTime() +
		toWallClockWallTimeMatch([hours, minutes, seconds, fraction]).getTime();

	return createUnit(summedTimestamps, "date");
}

export function matchWallClockTimeExpression(content: string): WallClockUnit | null {
	if (typeof content !== "string") {
		return null;
	}

	if (!content.startsWith("wallclock")) {
		return null;
	}

	let match: RegExpMatchArray | null = null;

	if ((match = content.match(WALLCLOCK_DATETIME_REGEX))) {
		return createWallClockDateTimeUnit(match);
	}

	if ((match = content.match(WALLCLOCK_WALLTIME_REGEX))) {
		return createUnit(
			toWallClockWallTimeMatch([match[1], match[2], match[3], match[4]]).getTime(),
			"date",
		);
	}

	if ((match = content.match(WALLCLOCK_DATE_REGEX))) {
		return createUnit(toWallClockDateMatch([match[1], match[2], match[3]]).getTime(), "date");
	}

	return null;
}
