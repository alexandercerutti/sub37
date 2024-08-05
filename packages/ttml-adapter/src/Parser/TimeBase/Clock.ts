import type { TimeDetails } from ".";
import type { ClockTimeUnit } from "../TimeExpressions/matchers/clockTime";
import type { OffsetTimeUnit } from "../TimeExpressions/matchers/offsetTime";
import type { WallClockUnit } from "../TimeExpressions/matchers/wallclockTime";
import { getHHMMSSUnitsToSeconds } from "../TimeExpressions/math.js";

/** To keep track and debug */
export const timeBaseNameSymbol = Symbol("Clock Time Base");

export function getMillisecondsByClockTime(match: ClockTimeUnit): number {
	const [hoursUnit, minutesUnit, secondsUnit, framesUnit, subframesUnit] = match;

	assertClockTimeWithoutFrames(framesUnit?.value);
	assertClockTimeWithoutSubframes(subframesUnit?.value);

	return getHHMMSSUnitsToSeconds(hoursUnit.value, minutesUnit.value, secondsUnit.value) * 1000;
}

/**
 * There is no documentation about WallClockTime but we do expect it
 * to be relative to UTC and Unix Epoch (1970-01-01), but in milliseconds.
 *
 * Therefore, when setting the source for time in @sub37/server, it should be
 * a `Date.now()`.
 *
 * @param match
 */

export function getMillisecondsByWallClockTime(match: WallClockUnit): number {
	return match.value;
}

/**
 * TTML standard states:
 *
 * ```text
 * If a <time-expression> form does not use the ticks (t) metric, then:
 * C = 3600 * hours + 60 * minutes + seconds
 *
 * where hours, minutes, and seconds components are extracted from time expression
 * if present, or zero if not present;
 * furthermore, a fraction component, if present, is added to the seconds component
 * to form a real-valued seconds component.
 *
 * Otherwise, if a <time-expression> form uses the ticks (t) metric, then:
 *
 * C = ticks / tickRate
 * ```
 *
 * But there is not any other time-expression that allows metrics, so
 * we assume we are talking about offset-time. In that case, we have to consider
 * all the other metrics.
 *
 * Also TTML standard states:
 *
 * ```text
 * A begin attribute must be specified, the value of which must take the offset-time
 * form of a <time-expression>, and, further, is restricted to use a metric of
 * s (seconds), f (frames), t (ticks), or may omit the metric, in which case s seconds
 * is implied.
 * ```
 *
 * So, even if there are other metrics, we probably should implement just the ones
 * stated above. However, `ticks` is implemented in a different flow, while `frames`
 * should not be considered when using clock time base. Hence, we are considering
 * the data as seconds.
 *
 * @param match
 * @param timeDetails
 * @returns
 */

export function getMillisecondsByOffsetTime(
	match: OffsetTimeUnit,
	timeDetails: TimeDetails,
): number {
	const { value: timeCount, metric } = match;

	if (metric === "t") {
		// e.g. 10_100_000 / 10_000_000 = 1,001 * 1000 = 1000.99999999. Don't need that decimal part.
		return Math.ceil((timeCount / (timeDetails["ttp:tickRate"] || 1)) * 1000);
	}

	if (metric === "f") {
		/**
		 * "The frames and sub-frames terms and the frames (f) metric
		 * of time expressions do not apply when using the clock time base."
		 *
		 * @see https://w3c.github.io/ttml2/#time-expression-semantics-clock
		 */

		throw new Error(
			`Cannot get milliseconds from offset-time when ttp:timeBase is 'clock'. Frame metrics do not apply. Received "${timeCount}${metric}".`,
		);
	}

	if (metric === "ms") {
		/**
		 * Is ms allowed in this case? Can we consider it as part of
		 * the seconds? We actually want to obtain milliseconds, so
		 * no need to convert, I guess?
		 */
		return timeCount;
	}

	if (metric === "s") {
		return timeCount * 1000;
	}

	if (metric === "m") {
		return timeCount * 60 * 1000;
	}

	return timeCount * 3600 * 1000;
}

/**
 * "It is considered an error if a frames term or f (frames) metric
 * is specified when the clock time base applies."
 *
 * @see https://w3c.github.io/ttml2/#timing-value-time-expression
 *
 * @param frames
 * @returns
 */

function assertClockTimeWithoutFrames(frames: number | undefined): asserts frames is undefined {
	if (!frames) {
		return;
	}

	throw new Error(
		`Cannot convert clock-time in milliseconds with Clock Time Base: 'frames' field is not allowed (received: '${frames}').`,
	);
}

/**
 * "It is considered an error if a sub-frames term is specified
 * when the clock time base applies."
 *
 * @see https://w3c.github.io/ttml2/#timing-value-time-expression
 *
 * @param frames
 * @returns
 */

function assertClockTimeWithoutSubframes(
	subframes: number | undefined,
): asserts subframes is undefined {
	if (!subframes) {
		return;
	}

	throw new Error(
		`Cannot convert clock-time in milliseconds with Clock Time Base: 'subframes' field is not allowed (received: '${subframes}').`,
	);
}
