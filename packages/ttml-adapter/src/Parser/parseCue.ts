/** months | days | hours2 | minutes | seconds */
const AT_LEAST_ONE_DIGIT_TIME_REGEX = /\d{1,}/;
const AT_LEAST_TWO_DIGITS_REGEX = /\d{2,}/;
const EXACT_TWODIGITS_REGEX = /\d{2}/;

/**
 * Regexes are ordered in almost-identical-reverted order of
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#timing-value-time-expression
 */

/**
 * hours | minutes | seconds | milliseconds | frames | ticks
 */
const TIME_METRIC_UNIT_REGEX = /h|m|s|ms|f|t/;

const TIME_COUNT_REGEX = AT_LEAST_ONE_DIGIT_TIME_REGEX;

// double escaping to support literal dot "." instead of 'any character'
const FRACTION_REGEX = new RegExp(`\\.(${AT_LEAST_ONE_DIGIT_TIME_REGEX.source})`);
const SUBFRAMES_REGEX = AT_LEAST_ONE_DIGIT_TIME_REGEX;
const FRAMES_REGEX = AT_LEAST_TWO_DIGITS_REGEX;

const MONTHS_REGEX = EXACT_TWODIGITS_REGEX;
const DAYS_REGEX = EXACT_TWODIGITS_REGEX;
const HOURS2_REGEX = EXACT_TWODIGITS_REGEX;
const MINUTES_REGEX = EXACT_TWODIGITS_REGEX;
const SECONDS_REGEX = EXACT_TWODIGITS_REGEX;

const HOURS_REGEX = AT_LEAST_TWO_DIGITS_REGEX; /** Includes both "hours2" and "hours3plus" */

/** hours2 ":" minutes */
const HHMM_TIME = new RegExp(`(${HOURS2_REGEX.source}):(${MINUTES_REGEX.source})`);

/** hours2 ":" minutes ":" seconds fraction? */
const HHMMSS_TIME = new RegExp(
	`${HHMM_TIME.source}:(${SECONDS_REGEX.source})(?:${FRACTION_REGEX.source})?`,
);

/** ( hhmm-time | hhmmss-time ) -> HHMMSS is more specific, so it must be put before */
const WALL_TIME_REGEX = new RegExp(`${HHMMSS_TIME.source}|${HHMM_TIME.source}`);

/** years "-" months "-" days */
const DATE_REGEX = new RegExp(`(\d{4})-(${MONTHS_REGEX.source})-(${DAYS_REGEX.source})`);

/** date "T" wall-time */
const DATE_TIME_REGEX = new RegExp(`${DATE_REGEX.source}T(?:${WALL_TIME_REGEX.source})`);

/**
 * "wallclock(" <lwsp>? ( date-time | wall-time | date ) <lwsp>? ")"
 */
const WALLCLOCK_TIME_REGEX = new RegExp(
	`wallclock\(\"\s*(?:(?:${DATE_TIME_REGEX.source})|(?:${WALL_TIME_REGEX.source})|(?:${DATE_REGEX.source}))\s*\"\)`,
);

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
