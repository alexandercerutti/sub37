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
		const fraction = parseInt(match[4]);

		if (!Number.isNaN(fraction)) {
			const fractionInSeconds = fraction / 10 ** getNumberOfDigits(fraction);
			finalTime += fractionInSeconds;
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

	if (timeDetails["ttp:timeBase"] === "smpte") {
		/**
		 * @TODO how to provide previous cue end time?
		 */

		const referenceBegin = 0;

		/**
		 * Subframes are accounted later
		 */
		const framesInSeconds =
			getFrameComputedValue(match[5], timeDetails["ttp:frameRate"]) /
			getEffectiveFrameRate(timeDetails);
		const countedFrames = finalTime * timeDetails["ttp:frameRate"] + framesInSeconds;

		const droppedFrames = getSMPTEDropFrames(timeDetails["ttp:dropMode"], [
			matchedWithContraints[0],
			matchedWithContraints[1],
		]);

		const subframes =
			getFrameComputedValue(match[6], timeDetails["ttp:subFrameRate"]) /
			timeDetails["ttp:subFrameRate"];

		const frames = countedFrames - droppedFrames + subframes;

		const SMTPETimeBase = frames / getEffectiveFrameRate(timeDetails);
		return referenceBegin + SMTPETimeBase;
	}

	return finalTime;
}

/**
 * Black-and-white broadcasts were originally streamed at 30fps (NTSC).
 * With the introduction of the color in 1953, fps was reduced to 29.97fps.
 *
 * This translates to have a lag of 0.03 frames between real world and video
 * timecodes: 01:00:00:00 (h:m:s:frames) of real time becomes 00:59:56;12 of video
 * (3.6 seconds). How do we flat the difference? We have to discard some frames
 * from the counting (not from the video, of course).
 *
 * First of all, 30fps is 0.1% faster than 29.97fps (30fps / 29.97fps ≈ 1,001).
 *
 * 1h = 60s * 60m = 3.600s.
 * At 30,00 fps, one hour of content contains 108.000 frames per hour (30,00fps * 3600s)
 * At 29,97 fps, one hour of content contains 107.892 frames per hour (29,97fps * 3600s).
 *
 * There is, therefore, a discrepancy between 30 and 29.97 of:
 *
 * 108.000 - 107.892 = 108 frames
 * 108 frames / 30fps = 3,6s (here we find it again!)
 *
 * 108.000 / 108 = 1.000 (discrepancy of 1/1000)
 *
 * ---
 *
 * 30fps is 0.1% faster than 29.97fps (30 / 29,97 ≈ 1.001)
 *
 * 1m = 60s.
 * At 30,00 fps, one minute of content contains 1800,0 frames per minute (30,00fps * 60s).
 * At 29,97 fps, one minute of content contains 1798,2 frames per minute (29,97fps * 60s).
 *
 * There is, therefore, a discrepancy between 30 and 29.97 of:
 *
 * 1800 - 1798,2 = 1.8 frames / minute
 * 1.8 * 1000 = 1800 (here we find it again)
 *
 * ---
 *
 * We might add 1.8 frame each minute, but frames are not fractionable!
 * We can, instead, add 18 frames every 10 minutes. So, listen up:
 * 10 / 18 is not evenly distributable (integer). 10 minutes is made of
 * 10 * 1 minute. What is the nearest number? 9, which is 18 * 2.
 *
 * So we can think to remove 2 frames every minute for 9 minutes and
 * not apply this rule for the 10th.
 *
 * By doing this, we skip 6 minutes: 00, 10, 20, 30, 40, and 50 (up to total 59).
 *
 * Therefore we discard 2 frames per minutes per 54 minute. Therefore, each hour
 * we discard 108 frames!! (60 - 6 minutes * 2 = 54 * 2 = 108). YAY!
 *
 * Then we have to add the right amount of frames for the minutes we have in
 * our real timecode.
 *
 * We want to remove 2 frames each minute more (2 * 59 = 118 frames)
 * However we get too much frames: we must have up to 108.
 * There's a difference of 10 frames.
 *
 * So we can divide the minute by 10 and floor everything to avoid the decimal part.
 * Minutes can be up to 59.
 *
 * floor (00 / 10) = 0
 * floor (01 / 10) = 0
 * floor (10 / 10) = 1
 * floor (20 / 10) = 2
 * floor (30 / 10) = 3
 * floor (40 / 10) = 4
 * floor (50 / 10) = 5
 * floor (59 / 10) = 5
 *
 * So we can reach up to 5 minutes times 2 frames to be removed and add
 * back these frames (2 per each minute skipped, as above).
 *
 * For NTSC we end up with the following formula and recap:
 *
 * - 108 frames per hour removed = 54 * 2 frames per hour removed;
 * - 2 frames per minute removed = 1 * 2 frames per minute removed;
 * - 2 frames recovered per up to 5 minutes.
 *
 * Becomes:
 *
 *   (hours * 54 * 2) + (minutes * 2) - (floor(minute / 10) * 2) =
 * = (hours * 54 + minutes - floor (minute / 10)) * 2.
 *
 * @see https://studylib.net/doc/18881551/an-explanantion-of-drop-frame-vs.-non-drop
 *
 * ___
 *
 * The same should be valid for PAL. Normal PAL runs at 25fps so SMPTE
 * doesn't expect any frame reduction. On the other side, M/PAL (Brazil only)
 * is PAL that runs at 29.97fps instead of 30 fps. So we probably want to convert
 * it to NTSC o something like that. I wasn't able to find any precise explanation,
 * so everything might be dependand on the frequencies and something like that.
 *
 * Anyway, we still want to drop 108 frames per hour (h * 180).
 * Then, PAL/M is said to drop 4 frames (00, 01, 02, and 03) if the second of a
 * time expression is 00 and the minute of the time expression **is even** but
 * not 00, 20 or 40.
 *
 * If the second must be 00, we have up to 59 minutes slots on which we could
 * remove 4 frames. 59 * 4 = 236f/m. Too much. But, if we use only even ones:
 * floor(59 / 2) = 29
 * 29 * 4 = 116 f/m. Which is still bigger than 108, but only of 8 frames.
 * So we must remove 8 of them from the dropped ones.
 *
 * So, if we get 4 frames from the two slots ((00*4) + (20*4) + (40*4)), we
 * recover 8 frames. And we get exactly 108 frames.
 *
 * Something I am still missing is why it was chosen to remove 4 frames.
 * For NTSC, it is a matter of having 18f/10min => 2*9/10min.
 *
 * Maybe, if we make the reversed reasoning: 1,8f/m * 10min * 2 = 36f/20min = 4 * 9 / 20 min
 * which is 4 frames times 9 minutes ((20 min / 2) - 1 to have only even seconds).
 *
 * But still, why distributing 1,8f over 20 minutes? Is there a particular reason?
 *
 * Anyway, we get:
 *  - hour * 108/4 = hour * 27 * 4
 *  - floor(minutes / 2), for even numbers, multiplied by 4
 *  - floor(minutes / 20), to get back the 2 slots of frames lost (00 * 4, 20 * 4 and 40 * 4)
 *
 * floor (00 / 20) = 0
 * floor (20 / 20) = 1
 * floor (25 / 20) = 1
 * floor (40 / 20) = 2
 * floor (59 / 20) = 2
 *
 * Okay, yeah, this seems the perfect example for the analogy of "the importance of
 * a horse ass" (seriously, go looking for it. This story about legacy systems that
 * influence actual systems is amazing!)
 *
 * @param dropMode
 * @param time
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#time-expression-semantics-smpte
 * @returns
 */

function getSMPTEDropFrames(
	dropMode: TimeDetails["ttp:dropMode"],
	time: [hours: number, minutes: number],
): number {
	if (!dropMode) {
		return 0;
	}

	if (dropMode === "dropNTSC") {
		const [hours, minutes] = time;
		return (hours * 54 + minutes - Math.floor(minutes / 10)) * 2;
	}

	/**
	 * Phase Alternate Line
	 * Valid only for M/PAL or PAL-M, which is used
	 * only in Brasil
	 */
	if (dropMode === "dropPAL") {
		const [hours, minutes] = time;

		return (hours * 27 + Math.floor(minutes / 2) - Math.floor(minutes / 20)) * 4;
	}

	// nonDrop mode
	return 0;
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
	const frames =
		getFrameComputedValue(framesString, timeDetails["ttp:frameRate"]) +
		getFrameComputedValue(subFramesString, timeDetails["ttp:subFrameRate"]) /
			timeDetails["ttp:subFrameRate"];

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
 * Converts frame number and clamps it to be positive and lower than a rate.
 * @param frameString
 * @param rate
 * @returns
 */

function getFrameComputedValue(frameString: string, rate: number): number {
	const frame = parseInt(frameString);

	if (rate <= 0 || Number.isNaN(frame)) {
		return 0;
	}

	return Math.max(0, Math.min(frame, rate - 1));
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
