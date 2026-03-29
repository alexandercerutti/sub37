import type { BaseAnimation } from "../../Scope/AnimationContainerContext.js";
import type { Spline } from "../keySplines/index.js";
import { assertKeySplinesMissing, extractTimingAttributes, getFill, getRepeatCount } from "./factory.js";
import { KeyTimesPacedNotAllowedError } from "../keyTimes/KeyTimesNotAllowedError.js";

/**
 * keySplines in a paced animation are just a linear sequence of numbers
 * to be remapped to a cubic-bezier function, which is valid for linear animations as well.
 */
export interface PacedAnimation extends BaseAnimation {
	calcMode: "paced";
	keySplines: Spline[];
}

export function createPacedAnimation(animationId: string, attributes: Record<string, string>): PacedAnimation {
	assertKeySplinesMissing(attributes);
	assertKeyTimesMissing(attributes);

	const timingAttributes = extractTimingAttributes(attributes);

	return {
		id: animationId,
		calcMode: "paced",

		/**
		 * Will get inferred later.
		 * This is the reason for the getter for keySplines.
		 */
		keyTimes: [],

		repeatCount: getRepeatCount(attributes["repeatCount"]),
		fill: getFill(attributes["fill"]),
		timingAttributes,
		get keySplines() {
			return this.keyTimes.map(() => [0, 0, 1, 1]) as Spline[];
		},
	};
}

function assertKeyTimesMissing(
	attributes: Record<string, string>,
): asserts attributes is Record<string, string> & { keyTimes?: never } {
	if ('keyTimes' in attributes) {
		throw new KeyTimesPacedNotAllowedError();
	}
}