import { KeyTimesAmountNotMatchingError } from "./KeyTimesAmountNotMatchingError";
import { KeyTimesAscendingOrderViolationError } from "./KeyTimesAscendingOrderViolationError";
import { KeyTimesComponentOutOfBoundaryError } from "./KeyTimesComponentOutOfBoundaryError";
import { KeyTimesFirstValueNotZeroError } from "./KeyTimesFirstValueNotZeroError";
import { KeyTimesInferredMinimumUnmatchedError } from "./KeyTimesInferredMinimumUnmatchedError";
import { KeyTimesInferredUnmatchedAnimationValueError } from "./KeyTimesInferredUnmatchedAnimationValueError";
import { KeyTimesLastValueNotOneError } from "./KeyTimesLastValueNotOneError";
import type { AnimationValueListMap } from "../parseAnimation";

/**
 *
 * @param value
 * @param styles
 * @returns
 */
export function getKeyTimes(value: string, animationValueLists: AnimationValueListMap): number[] {
	const splittedKeyTimes = value.split(";").map((kt) => parseFloat(kt)) || [];

	if (splittedKeyTimes.length) {
		assertAllKeyTimesWithinBoundaries(splittedKeyTimes);
		assertKeyTimesBeginIsZero(splittedKeyTimes[0]);
		assertKeyTimesAmountMatchingAnimationValueLists(splittedKeyTimes, animationValueLists);

		return splittedKeyTimes;
	}

	const keyTimesFound = getKeyTimesAmountFromAnimationValueLists(animationValueLists);

	const keyTimes = new Array<number>(keyTimesFound).fill(0.0);
	const factor = 1 / (keyTimesFound - 1);

	for (let i = 0; i < keyTimesFound; i++) {
		keyTimes[i] = i * factor;
	}

	return keyTimes;
}

function getKeyTimesAmountFromAnimationValueLists(
	animationValueLists: AnimationValueListMap,
): number {
	let keyTimesAmount = 0;

	for (const list of animationValueLists) {
		const animationValueList = list[1];

		if (animationValueList.length < 2) {
			throw new KeyTimesInferredMinimumUnmatchedError();
		}

		if (!keyTimesAmount) {
			keyTimesAmount = animationValueList.length;
			continue;
		}

		if (animationValueList.length !== keyTimesAmount) {
			const styleName = list[0];
			throw new KeyTimesInferredUnmatchedAnimationValueError(
				styleName,
				animationValueList.length,
				keyTimesAmount,
			);
		}
	}

	return keyTimesAmount;
}

function assertKeyTimesAmountMatchingAnimationValueLists(
	keyTimes: number[],
	animationValueLists: AnimationValueListMap,
): void {
	for (const [styleName, animationValueList] of animationValueLists) {
		if (animationValueList.length === keyTimes.length) {
			continue;
		}

		throw new KeyTimesAmountNotMatchingError(keyTimes.length, styleName);
	}
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
 * "The ‘keyTimes’ list semantics depends upon the interpolation mode:
 * 		For linear and spline animation, the first time value in the list
 * 		must be 0, and the last time value in the list must be 1. The key
 * 		time associated with each value defines when the value is set;
 * 		values are interpolated between the key times.
 *
 * 		For discrete animation, the first time value in the list must be 0.
 * 		The time associated with each value defines when the value is set;
 * 		the animation function uses that value until the next time defined
 * 		in ‘keyTimes’."
 *
 * @see https://www.w3.org/TR/2011/REC-SVG11-20110816/animate.html#KeyTimesAttribute
 */
export function assertKeyTimesBeginIsZero(value: number): void {
	if (value !== 0) {
		throw new KeyTimesFirstValueNotZeroError();
	}
}

export function assertKeyTimesEndIsOne(value: number): void {
	if (value !== 0) {
		throw new KeyTimesLastValueNotOneError();
	}
}
