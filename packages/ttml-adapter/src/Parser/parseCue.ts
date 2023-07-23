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

/**
 * @param match
 * @param timeDetails
 * @returns amount of time in milliseconds
 */

function convertClockTimeToMilliseconds(match: RegExpMatchArray, timeDetails: TimeDetails): number {
	let finalTime = 0;
	// const [, hours, minutes, seconds, fraction, frames, subframes] = match;

	const matchedWithContraints = [
		parseInt(match[1]),
		Math.max(0, Math.min(parseInt(match[2]), 59)),
		Math.max(0, Math.min(parseInt(match[3]), 59)),
	];

	for (let i = 0; i < 3; i++) {
		const element = matchedWithContraints[i];
		// index: x, arr.length: y => 60^(y-1-x) => ...
		// index: 0, arr.length: 3 => 60^(3-1-0) => 60^2 => number * 3600
		// index: 1, arr.length: 3 => 60^(3-1-1) => 60^1 => number * 60
		// index: 2, arr.length: 3 => 60^(3-1-2) => 60^0 => number * 1
		finalTime += element * 60 ** (3 - 1 - i);
	}

	if (timeDetails["ttp:timeBase"] === "clock") {
		let fraction = parseInt(match[4]);

		if (!Number.isNaN(fraction)) {
			fraction = fraction / 10 ** getNumberOfDigits(fraction);
			finalTime += fraction;
		}

		return finalTime * 1000;
	}

	/**
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-media-timing
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-frameRate
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-frameRateMultiplier
	 */

	if (timeDetails["ttp:timeBase"] === "media") {
		/**
		 * @TODO how to provide previous cue end time?
		 */

		const referenceBegin = 0;

		const framesInSeconds = getActualFramesInSeconds(match[5], match[6], timeDetails);

		return (referenceBegin + finalTime + framesInSeconds) * 1000;
	}

	/**
	 * @TODO implement SMTPE (society of motion pictures and television engineers)
	 */

	return finalTime;
}

/**
 * Given frames string (from matched regex) and the subframes
 * converts the value in seconds
 *
 * @param framesString
 * @param subFramesString
 * @param timeDetails
 * @returns
 */

function getActualFramesInSeconds(
	framesString: string,
	subFramesString: string | undefined,
	timeDetails: TimeDetails,
): number {
	if (!timeDetails["ttp:frameRate"]) {
		return 0;
	}

	/**
	 * If a <time-expression> is expressed in terms of a clock-time
	 * and a frames term is specified, then the value of this term
	 * must be constrained to the interval [0…F-1], where F is the
	 * frame rate determined by the ttp:frameRate parameter as
	 * defined by 7.2.5 ttp:frameRate
	 */
	let frames = Math.max(0, Math.min(parseInt(framesString), timeDetails["ttp:frameRate"] - 1));

	if (Number.isNaN(frames)) {
		return 0;
	}

	let subframes = parseInt(subFramesString);

	if (timeDetails["ttp:subFrameRate"] > 0 && !Number.isNaN(subframes)) {
		subframes = Math.max(0, Math.min(subframes, timeDetails["ttp:subFrameRate"] - 1));
		frames += subframes / timeDetails["ttp:subFrameRate"];
	}

	/**
	 * Getting how many seconds this is going to last
	 *
	 * @example
	 *
	 * ```
	 * effectiveFrameRate = 60fps
	 * frames = 24.3
	 *
	 * finalFramesMount = 24.3 / 60 = ~0.4s
	 * ```
	 */
	return frames / getEffectiveFrameRate(timeDetails);
}

function getEffectiveFrameRate(timeDetails: TimeDetails): number {
	return timeDetails["ttp:frameRate"] * (timeDetails["ttp:frameRateMultiplier"] ?? 1);
}

/**
 * @see https://stackoverflow.com/a/14879700/2929433
 * We don't aim to support under Safari 8, so using Math.log10()
 * is fine.
 *
 * Anyway, let's take a moment to appreciate the beautifulness
 * of this solutions... that I do not understand (except for
 * the "| 0", which is needed for rounding)
 *
 * @param num
 * @returns
 */

function getNumberOfDigits(num: number): number {
	return (Math.log10(num) + 1) | 0;
}
