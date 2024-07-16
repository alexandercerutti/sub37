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
export const TIME_METRIC_UNIT_REGEX = /h|m|s|ms|f|t/;

export const TIME_COUNT_REGEX = AT_LEAST_ONE_DIGIT_TIME_REGEX;

// double escaping to support literal dot "." instead of 'any character'
export const FRACTION_REGEX = new RegExp(`\\.(${AT_LEAST_ONE_DIGIT_TIME_REGEX.source})`);
export const SUBFRAMES_REGEX = AT_LEAST_ONE_DIGIT_TIME_REGEX;
export const FRAMES_REGEX = AT_LEAST_TWO_DIGITS_REGEX;
export const MONTHS_REGEX = EXACT_TWODIGITS_REGEX;
export const DAYS_REGEX = EXACT_TWODIGITS_REGEX;
export const HOURS2_REGEX = EXACT_TWODIGITS_REGEX;
export const MINUTES_REGEX = EXACT_TWODIGITS_REGEX;
export const SECONDS_REGEX = EXACT_TWODIGITS_REGEX;

/** Includes both "hours2" and "hours3plus" */
export const HOURS_REGEX = AT_LEAST_TWO_DIGITS_REGEX;

// ************************ //
// *** TIME EXPRESSIONS *** //
// ************************ //

/**
 * Includes both
 *
 * - `hours2 ":" minutes`
 * - `hours2 ":" minutes ":" seconds fraction?`
 */
export const HHMMSS_TIME_REGEX = new RegExp(
	`(${HOURS2_REGEX.source}):(${MINUTES_REGEX.source})(?::(${SECONDS_REGEX.source})(?:${FRACTION_REGEX.source})?)?`,
);

/** years "-" months "-" days */
export const DATE_REGEX = new RegExp(`(\\d{4})-(${MONTHS_REGEX.source})-(${DAYS_REGEX.source})`);
