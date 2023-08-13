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
