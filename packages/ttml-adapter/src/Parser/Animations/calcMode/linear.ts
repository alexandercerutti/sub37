import type { BaseAnimation } from "../../Scope/AnimationContainerContext.js";
import type { Spline } from "../keySplines/index.js";
import { getKeyTimes } from "../keyTimes/index.js";
import { assertKeySplinesMissing, extractTimingAttributes, getFill, getRepeatCount } from "./factory.js";

/**
 * keySplines in a linear animation are just a linear sequence of numbers
 * to be remapped to a cubic-bezier function.
 */
export interface LinearAnimation extends BaseAnimation {
	calcMode: "linear";
	keySplines: Spline[];
}

export function createLinearAnimation(animationId: string, attributes: Record<string, string>): LinearAnimation {
	assertKeySplinesMissing(attributes);

	const timingAttributes = extractTimingAttributes(attributes);

	return {
		id: animationId,
		calcMode: "linear",
		keyTimes: getKeyTimes(attributes["keyTimes"]),
		repeatCount: getRepeatCount(attributes["repeatCount"]),
		fill: getFill(attributes["fill"]),
		timingAttributes,
		get keySplines() {
			return this.keyTimes.map(() => [0, 0, 1, 1]) as Spline[];
		},
	};
}
