import type { BaseAnimation } from "../../Scope/AnimationContainerContext.js";
import type { TimeContextData } from "../../Scope/TimeContext.js";
import type { UniquelyAnnotatedNode } from "../../Token.js";
import { KeySplinesNotAllowedError } from "../keySplines/KeySplinesNotAllowedError.js";
import { createDiscreteAnimation } from "./discrete.js";
import { createLinearAnimation } from "./linear.js";
import { createPacedAnimation } from "./paced.js";
import { createSplineAnimation } from "./spline.js";

type DiscreteCalcMode = "discrete";
type ContinuousCalcMode = "linear" | "paced" | "spline";

type CalcMode = DiscreteCalcMode | ContinuousCalcMode;
	
export type CalcModeFactory = (animationId: string, attributes: Record<string, string> & UniquelyAnnotatedNode) => BaseAnimation | undefined;

export function getAnimationFactoryByCalcMode(calcMode: string): CalcModeFactory {
	switch (calcMode as CalcMode) {
		case "discrete": {
			return createDiscreteAnimation;
		}

		case "linear": {
			return createLinearAnimation;
		}

		case "paced": {
			return createPacedAnimation;
		}

		case "spline": {
			return createSplineAnimation;
		}

		default: {
			function noop() {
				console.warn(
					"Found an animation definition with an unsupported 'calcMode' value. Allowed values are 'discrete' | 'linear' | 'paced' | 'spline'. '<set>' is automatically considered as 'discrete'. Animation ignored.",
				);
				
				return undefined;
			}

			noop.calcMode = "" as CalcMode;

			return noop;
		}
	}
}


export function assertKeySplinesMissing(
	attributes: Record<string, string>,
): asserts attributes is Record<string, string> & { keySplines?: never } {
	if ('keySplines' in attributes) {
		throw new KeySplinesNotAllowedError();
	}
}

export function extractTimingAttributes(
	attributes: Record<string, string>,
): Omit<TimeContextData, "timeContainer"> {
	return {
		begin: attributes["begin"],
		dur: attributes["dur"],
		end: attributes["end"],
	};
}

/**
 * <repeat-count>
 *
 * @param value
 * @returns
 * @see https://w3c.github.io/ttml2/#animation-value-repeat-count
 */
export function getRepeatCount(value: "indefinite" | string | undefined): number {
	if (!value) {
		return 1;
	}

	if (value === "indefinite") {
		return Infinity;
	}

	const parsed = parseFloat(value);

	return Math.max(1, parsed);
}

function isValidFillValue(value: string): value is "freeze" | "remove" {
	return value === "freeze" || value === "remove";
}

export function getFill(value: string | undefined): "freeze" | "remove" {
	if (!value) {
		return "remove";
	}

	if (!isValidFillValue(value)) {
		return "remove";
	}

	return value;
}