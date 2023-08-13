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

export function getNumberOfDigits(num: number): number {
	return (Math.log10(num) + 1) | 0;
}

/**
 * Convers hours, minutes and seconds in seconds
 *
 * @param hours
 * @param minutes
 * @param seconds
 * @returns
 */

export function getHHMMSSUnitsToSeconds(
	hours: number,
	minutes: number,
	seconds?: number | undefined,
) {
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

		if (!Number.isNaN(element)) {
			finalTime += element * 60 ** (3 - 1 - i);
		}
	}

	return finalTime;
}
