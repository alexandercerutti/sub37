import type { ClockTimeMatch } from "../TimeExpressions/clockTime";
import type { OffsetTimeMatch } from "../TimeExpressions/offsetTime";

export function getMillisecondsByClockTime(match: ClockTimeMatch): number {
	const [hours, minutes, seconds, fraction] = match;
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

	if (!Number.isNaN(fraction)) {
		const fractionInSeconds = fraction / 10 ** getNumberOfDigits(fraction);
		finalTime += fractionInSeconds;
	}

	return finalTime * 1000;
}

export function getMillisecondsByWallClockTime(): number {
	return 0;
}

export function getMillisecondsByOffsetTime(match: OffsetTimeMatch): number {
	return 0;
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
