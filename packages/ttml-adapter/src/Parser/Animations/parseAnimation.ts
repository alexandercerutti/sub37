import { memoizationFactory } from "../memoizationFactory.js";
import { isStyleAttribute } from "../parseStyle.js";
import type { Scope } from "../Scope/Scope";
import { KeySplinesNotAllowedError } from "./KeySplinesNotAllowedError.js";
import { KeySplinesRequiredError } from "./KeySplinesRequiredError.js";
import { KeyTimesPacedNotAllowedError } from "./KeyTimesNotAllowedError.js";

interface MetaAnimation extends Record<string, string> {
	keyTimes?: string;
	keySplines?: string;
	fill?: string;
	repeatCount?: string;
	calcMode?: string;
	begin?: string;
	end?: string;
	dur?: string;
}

type AnimationTypes = "discrete" | "continuous";

interface Animation<Kind extends AnimationTypes> {
	kind: Kind;
	fill: "freeze" | "remove";
	repeatCount: number;
	rawTimingAttributes: {
		begin?: string;
		end?: string;
		dur?: string;
	};
}

interface DiscreteAnimation extends Animation<"discrete"> {}

interface ContinuousAnimation extends Animation<"continuous"> {
	keyTimes?: number[];
	keySplines?: (0 | 1)[];
}

export const createAnimationParser = memoizationFactory(function animationParser(
	animationStorage: Map<string, unknown>,
	scope: Scope | undefined,
	attributes: MetaAnimation,
): Animation<AnimationTypes> | undefined {
	const calcMode = attributes["calcMode"];

	switch (true) {
		case isDiscreteAnimation(calcMode): {
			if (attributes["keySplines"]) {
				throw new KeySplinesNotAllowedError();
			}

			const animation = createDiscreteAnimation(attributes);

			break;
		}

		case isContinuousLinearAnimation(calcMode): {
			if (attributes["keySplines"]) {
				throw new KeySplinesNotAllowedError();
			}

			const animation = createContinuousAnimation(attributes);

			break;
		}

		case isContinuousPacedAnimation(calcMode): {
			if (attributes["keySplines"]) {
				throw new KeySplinesNotAllowedError();
			}

			if (attributes["keyTimes"]) {
				throw new KeyTimesPacedNotAllowedError();
			}

			const animation = createContinuousAnimation(attributes);

			break;
		}

		case isContinuousSplineAnimation(calcMode): {
			if (!attributes["keySplines"]) {
				throw new KeySplinesRequiredError();
			}

			const animation = createContinuousAnimation(attributes);

			const keyTimes = getKeyTimes(attributes["keyTimes"], attributes);

			if (!keyTimes.length) {
				return undefined;
			}

			// animationStorage.set();

			break;
		}
	}

	console.warn(
		"Found an animation definition with an unsupported 'calcMode' value. Allowed values are 'discrete' | 'linear' | 'paced' | 'spline'. Set is automatically considered as 'discrete'. Animation ignored.",
	);

	return undefined;
});

/**
 * Discrete value will happen exclusively
 * when animation is defined through `<animate>`
 * tag. `<set>` won't have this, and it is
 * discrete by design.
 *
 * @param calcMode
 * @returns
 */
function isDiscreteAnimation(calcMode: string | undefined): calcMode is "discrete" {
	return typeof calcMode === "undefined" || calcMode === "discrete";
}

function isContinuousLinearAnimation(calcMode: string): calcMode is "linear" {
	return calcMode === "linear";
}

function isContinuousPacedAnimation(calcMode: string): calcMode is "paced" {
	return calcMode === "paced";
}

function isContinuousSplineAnimation(calcMode: string): calcMode is "spline" {
	return calcMode === "spline";
}

/**
 * <repeat-count>
 *
 * @param value
 * @returns
 * @see https://w3c.github.io/ttml2/#animation-value-repeat-count
 */

function getRepeatCount(value: "indefinite" | string): number {
	if (!value) {
		return 1;
	}

	if (value === "indefinite") {
		return Infinity;
	}

	const parsed = parseFloat(value);

	return Math.max(1, parsed);
}

function getFill(value: string): "freeze" | "remove" {
	if (!value) {
		return "remove";
	}

	if (!isValidFillValue(value)) {
		return "remove";
	}

	return value;
}

function isValidFillValue(value: string): value is "freeze" | "remove" {
	return value === "freeze" || value === "remove";
}

/**
 * @TODO waiting for the response from W3C question
 *
 * @param value
 * @param styles
 * @returns
 */
function getKeyTimes(value: string, styles: Record<string, string>): number[] {
	const styleAttributesEntries = Object.entries(styles).filter(([key]) => isStyleAttribute(key));

	const splittedKeyTimes = value.split(";").map((kt) => parseFloat(kt));

	if (!styleAttributesEntries.length && !splittedKeyTimes.length) {
		return [];
	}

	if (styleAttributesEntries.length && !splittedKeyTimes.length) {
		/**
		 * @TODO verify if all styleAttributesEnties have the same amount of steps
		 * @TODO get the amount
		 */

		const frames: number[] = [];

		if (!frames.length) {
			return [];
		}

		const factor = 1 / frames.length;

		return frames.map((frame) => frame * factor);
	}

	/**
	 * @TODO verify if all styleAttributesEnties have the same amount of steps
	 * @TODO verify if this amount corresponds to the keyTimes amount
	 */

	return [];
}

function getKeySplines(value: string, keyTimes: number[]): (0 | 1)[] {
	return;
}

function createAnimation<Kind extends AnimationTypes>(
	kind: Kind,
	attributes: Record<string, string>,
): Animation<Kind> {
	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const rawTimingAttributes = {
		begin: attributes["begin"],
		end: attributes["end"],
		dur: attributes["dur"],
	} as const;

	return {
		kind,
		repeatCount,
		fill,
		rawTimingAttributes,
	};
}

function createDiscreteAnimation(attributes: Record<string, string>): DiscreteAnimation {
	return createAnimation("discrete", attributes);
}

function createContinuousAnimation(attributes: Record<string, string>): ContinuousAnimation {
	return createAnimation("continuous", attributes);
}
