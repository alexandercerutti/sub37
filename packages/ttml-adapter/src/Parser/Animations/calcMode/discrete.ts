import { assertKeySplinesMissing, extractTimingAttributes, getFill, getRepeatCount } from "./factory.js";
import type { BaseAnimation } from "../../Scope/AnimationContainerContext.js";
import { getKeyTimes } from "../keyTimes/index.js";

export interface DiscreteAnimation extends BaseAnimation {
	calcMode: "discrete";
	keySplines: [];
}

/**
 * Discrete value will happen exclusively
 * when animation is defined through `<animate>`
 * tag. `<set>` won't have this, and it is
 * discrete by design.
 */
export function createDiscreteAnimation(
	animationId: string,
	attributes: Record<string, string>,
): DiscreteAnimation {
	assertKeySplinesMissing(attributes);
	const timingAttributes = extractTimingAttributes(attributes);

	return {
		id: animationId,
		calcMode: "discrete",
		keyTimes: getKeyTimes(attributes["keyTimes"]),
		repeatCount: getRepeatCount(attributes["repeatCount"]),
		fill: getFill(attributes["fill"]),
		timingAttributes,
		keySplines: [],
	};
}
