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

	const totalFrames =
		clampPositiveFrameRateValue(frames, timeDetails["ttp:frameRate"]) +
		clampPositiveFrameRateValue(subframes, timeDetails["ttp:subFrameRate"]) /
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
 * Clamps frame (or subframe) number to be positive and
 * lower than a specified rate.
 *
 * {@link rate} is expected to be positive greater than 0 or fallabck,
 * as per the definition of
 *  - [ttp:frameRate](https://w3c.github.io/ttml2/#parameter-attribute-frameRate); and
 *  - [ttp:subFrameRate](https://w3c.github.io/ttml2/#parameter-attribute-subFrameRate)
 *
 * Such rate check should be performed on field parsing.
 *
 * @param frame
 * @param rate
 * @returns
 */

export function clampPositiveFrameRateValue(frame: number, rate: number): number {
	return Math.max(0, Math.min(frame, rate));
}
