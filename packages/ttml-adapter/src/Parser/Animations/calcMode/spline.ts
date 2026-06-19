import { extractTimingAttributes, getFill, getRepeatCount } from "./factory.js";
import type { Spline } from "../keySplines/index.js";
import { getKeySplines } from "../keySplines/index.js";
import type { BaseAnimation } from "../../Scope/AnimationContainerContext.js";
import { KeySplinesRequiredError } from "../keySplines/KeySplinesRequiredError.js";
import { getKeyTimes } from "../keyTimes/index.js";

export interface SplineAnimation extends BaseAnimation {
	calcMode: "spline";
	keySplines: Spline[];
}

export function createSplineAnimation(animationId: string, attributes: Record<string, string>): SplineAnimation {
	assertKeySplineRequired(attributes);

	const keyTimes = getKeyTimes(attributes["keyTimes"]);
	const timingAttributes = extractTimingAttributes(attributes);

	return {
		id: animationId,
		calcMode: "spline",
		keyTimes,
		repeatCount: getRepeatCount(attributes["repeatCount"]),
		fill: getFill(attributes["fill"]),
		timingAttributes,
		get keySplines() {
			return getKeySplines(attributes["keySplines"], this.keyTimes);
		},
	};
}

function assertKeySplineRequired(
	attributes: Record<string, string>,
): asserts attributes is Record<string, string> & { keySplines: string } {
	if (!('keySplines' in attributes)) {
		throw new KeySplinesRequiredError();
	}
}