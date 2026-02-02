import { KeyTimesAscendingOrderViolationError } from "./KeyTimesAscendingOrderViolationError";
import { KeyTimesComponentOutOfBoundaryError } from "./KeyTimesComponentOutOfBoundaryError";
import { KeyTimesFirstValueNotZeroError } from "./KeyTimesFirstValueNotZeroError";
import { KeyTimesLastValueNotOneError } from "./KeyTimesLastValueNotOneError";

/**
 *
 * @param value
 * @param styles
 * @returns
 */
export function getKeyTimes(value: string | undefined): number[] {
	if (!value) {
		return [];
	}

	const splittedKeyTimes = value.split(";").map((kt) => parseFloat(kt)) || [];

	if (!splittedKeyTimes.length) {
		return [];
	}

	assertAllKeyTimesWithinBoundaries(splittedKeyTimes);
	assertKeyTimesBeginIsZero(splittedKeyTimes[0]);

	return splittedKeyTimes;
}

/**
 * Infers a paced list of keyTimes based on the amount provided.
 *
 * @example
 * 	`[0.0, 0.5, 1.0]` for amount `3`
 *  `[0.0, 0.25, 0.5, 0.75, 1.0]` for amount `5`
 *
 * @param amount
 * @returns
 */
export function getInferredPacedKeyTimesByAmount(amount: number): number[] {
	const keyTimes = new Array<number>(amount).fill(0.0);
	const factor = 1 / (amount - 1);

	for (let i = 0; i < amount; i++) {
		keyTimes[i] = i * factor;
	}

	return keyTimes;
}

function assertAllKeyTimesWithinBoundaries(values: number[]): void {
	let lastKeyTime = 0;

	for (const keyTime of values) {
		if (keyTime < 0 || keyTime > 1) {
			throw new KeyTimesComponentOutOfBoundaryError(keyTime);
		}

		if (keyTime < lastKeyTime) {
			throw new KeyTimesAscendingOrderViolationError(keyTime);
		}

		lastKeyTime = keyTime;
	}
}

/**
 * From SVG 1.1 standard:
 *
 * > "The ‘keyTimes’ list semantics depends upon the interpolation mode:
 * >	For linear and spline animation, the first time value in the list
 * >	must be 0, and the last time value in the list must be 1. The key
 * >	time associated with each value defines when the value is set;
 * >	values are interpolated between the key times.
 * >
 * >	For discrete animation, the first time value in the list must be 0.
 * >	The time associated with each value defines when the value is set;
 * >	the animation function uses that value until the next time defined
 * >	in ‘keyTimes’."
 *
 * @see https://www.w3.org/TR/2011/REC-SVG11-20110816/animate.html#KeyTimesAttribute
 */
export function assertKeyTimesBeginIsZero(value: number | undefined): void {
	if (value !== 0) {
		throw new KeyTimesFirstValueNotZeroError();
	}
}

export function assertKeyTimesEndIsOne(value: number | undefined): void {
	if (value !== 1) {
		throw new KeyTimesLastValueNotOneError();
	}
}
