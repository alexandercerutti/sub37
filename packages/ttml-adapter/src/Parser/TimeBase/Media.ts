/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-media-timing
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-frameRate
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-frameRateMultiplier
 */

import type { TimeDetails } from ".";
import type { ClockTimeMatch } from "../TimeExpressions/clockTime";
import type { OffsetTimeMatch } from "../TimeExpressions/offsetTime";
import { getActualFramesInSeconds } from "../TimeExpressions/frames.js";

export function getMillisecondsByClockTime(
	match: ClockTimeMatch,
	timeDetails: TimeDetails,
): number {
	const [hours, minutes, seconds, , frames, subframes] = match;
	let finalTime = 0;

	const matchedWithContraints = [
		hours,
		Math.max(0, Math.min(minutes, 59)),
		Math.max(0, Math.min(seconds, 59)),
	];

	for (let i = 0; i < 3; i++) {
		const element = matchedWithContraints[i];
		// index: x, arr.length: y => 60^(y-1-x) => ...
		// index: 0, arr.length: 3 => 60^(3-1-0) => 60^2 => number * 3600
		// index: 1, arr.length: 3 => 60^(3-1-1) => 60^1 => number * 60
		// index: 2, arr.length: 3 => 60^(3-1-2) => 60^0 => number * 1
		finalTime += element * 60 ** (3 - 1 - i);
	}

	/**
	 * @TODO how to provide previous cue end time?
	 */

	const referenceBegin = 0;

	const framesInSeconds = getActualFramesInSeconds(frames, subframes, timeDetails);

	return (referenceBegin + finalTime + framesInSeconds) * 1000;
}

export function getMillisecondsByWallClockTime(): number {
	return 0;
}

export function getMillisecondsByOffsetTime(match: OffsetTimeMatch): number {
	return 0;
}
