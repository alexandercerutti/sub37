import { DATE_REGEX, HHMMSS_TIME } from "./TimeExpressions";

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
	`wallclock\\("\\s*${DATE_REGEX.source}T(?:${HHMMSS_TIME.source})\\s*"\\)`,
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
const WALLCLOCK_WALLTIME_REGEX = new RegExp(`wallclock\\("\\s*${HHMMSS_TIME.source}\\s*"\\)`);

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
export type WallClockMatch = Date;

export function toWallClockWallTimeMatch(match: RegExpMatchArray): WallClockMatch {
	const [, hours, minutes, seconds, fraction] = match;

	const paddedHours = hours.padStart(2, "0");
	const paddedMinutes = minutes.padStart(2, "0");
	const paddedSeconds = (seconds || "0").padStart(2, "0");
	const timeString = `${paddedHours}:${paddedMinutes}:${paddedSeconds}.${fraction || 0}`;

	return new Date(`1970-01-01T${timeString}`);
}

export function toWallClockDateMatch(match: RegExpMatchArray): WallClockMatch {
	const [, year, month, day] = match;

	const paddedMonth = month.padStart(2, "0");
	const paddedDay = day.padStart(2, "0");

	return new Date(`${year}-${paddedMonth}-${paddedDay}T00:00:00`);
}

export function toWallClockDateTimeMatch(match: RegExpMatchArray): WallClockMatch {
	const [, year, month, day, hours, minutes, seconds, fraction] = match;

	return new Date(
		toWallClockDateMatch([year, month, day]).getTime() +
			toWallClockWallTimeMatch([hours, minutes, seconds, fraction]).getTime(),
	);
}

export function matchWallClockTimeExpression(content: string): WallClockMatch | null {
	if (typeof content !== "string") {
		return null;
	}

	if (!content.startsWith("wallclock")) {
		return null;
	}

	let match: RegExpMatchArray | null = null;

	if ((match = content.match(WALLCLOCK_DATETIME_REGEX))) {
		return toWallClockDateTimeMatch(match);
	}

	if ((match = content.match(WALLCLOCK_WALLTIME_REGEX))) {
		return toWallClockWallTimeMatch(match);
	}

	if ((match = content.match(WALLCLOCK_DATE_REGEX))) {
		return toWallClockDateMatch(match);
	}

	return null;
}
