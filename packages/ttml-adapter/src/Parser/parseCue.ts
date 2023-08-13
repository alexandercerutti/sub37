import { DATE_REGEX, HHMMSS_TIME } from "./TimeExpressions/TimeExpressions";
import {
	FRACTION_REGEX,
	FRAMES_REGEX,
	HOURS_REGEX,
	MINUTES_REGEX,
	SECONDS_REGEX,
	SUBFRAMES_REGEX,
	TIME_COUNT_REGEX,
	TIME_METRIC_UNIT_REGEX,
} from "./TimeExpressions/TimeUnits";

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

/**
 * time-count fraction? metric
 */
const OFFSET_TIME_REGEX = new RegExp(
	`(${TIME_COUNT_REGEX.source}(?:${FRACTION_REGEX.source})?)(${TIME_METRIC_UNIT_REGEX.source})`,
);

/**
 * hours ":" minutes ":" seconds ( fraction | ":" frames ( "." sub-frames )? )?
 */
const CLOCK_TIME_REGEX = new RegExp(
	`(${HOURS_REGEX.source}):(${MINUTES_REGEX.source}):(${SECONDS_REGEX.source})(?:${FRACTION_REGEX.source}|:(${FRAMES_REGEX.source})(?:\\.(${SUBFRAMES_REGEX.source}))?)?`,
);

const TIME_EXPRESSION_REGEX = new RegExp(
	`${CLOCK_TIME_REGEX.source}|${OFFSET_TIME_REGEX.source}|${WALLCLOCK_TIME_REGEX.source}`,
);

interface TimeDetails {
	"ttp:timeBase": "media" | "smpte" | "clock";
	"ttp:frameRate": number;
	"ttp:subFrameRate": number;
	"ttp:frameRateMultiplier": number;
	"ttp:tickRate": number;
	"ttp:dropMode": "dropNTSC" | "dropPAL";
}

function parseTimeString(timeString: string, timeDetails: TimeDetails): number {
	{
		const match = timeString.match(CLOCK_TIME_REGEX);
	}

	{
		const match = timeString.match(OFFSET_TIME_REGEX);
	}

	{
		const match = timeString.match(WALLCLOCK_TIME_REGEX);
	}
}
