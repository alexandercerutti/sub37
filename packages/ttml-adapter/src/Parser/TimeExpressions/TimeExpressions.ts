import {
	HOURS2_REGEX,
	MINUTES_REGEX,
	SECONDS_REGEX,
	FRACTION_REGEX,
	MONTHS_REGEX,
	DAYS_REGEX,
} from "./TimeUnits.js";

/**
 * Includes both
 *
 * hours2 ":" minutes
 * hours2 ":" minutes ":" seconds fraction?
 * */
export const HHMMSS_TIME = new RegExp(
	`(${HOURS2_REGEX.source}):(${MINUTES_REGEX.source})(?::(${SECONDS_REGEX.source})(?:${FRACTION_REGEX.source})?)?`,
);

/** years "-" months "-" days */
export const DATE_REGEX = new RegExp(`(\\d{4})-(${MONTHS_REGEX.source})-(${DAYS_REGEX.source})`);
