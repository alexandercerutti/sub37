import type { TimeDetails } from "../TimeBase";

/**
 * Given frames string (from matched regex) and the subframes
 * converts the value in seconds
 *
 * @param framesString
 * @param subFramesString
 * @param timeDetails
 * @returns
 */

export function getActualFramesInSeconds(
	frames: number,
	subframes: number | undefined,
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
	const totalFrames =
		getFrameComputedValue(frames, timeDetails["ttp:frameRate"]) +
		getFrameComputedValue(subframes, timeDetails["ttp:subFrameRate"]) /
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
	return totalFrames / getEffectiveFrameRate(timeDetails);
}

export function getEffectiveFrameRate(timeDetails: TimeDetails): number {
	return timeDetails["ttp:frameRate"] * (timeDetails["ttp:frameRateMultiplier"] ?? 1);
}

/**
 * Converts frame number and clamps it to be positive and lower than a rate.
 * @param frameString
 * @param rate
 * @returns
 */

export function getFrameComputedValue(frame: number, rate: number): number {
	if (rate <= 0 || Number.isNaN(frame)) {
		return 0;
	}

	return Math.max(0, Math.min(frame, rate - 1));
}
