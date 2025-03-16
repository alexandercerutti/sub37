import { memoizationFactory } from "../memoizationFactory.js";
import { isStyleAttribute } from "../parseStyle.js";
import type { Scope } from "../Scope/Scope";
import { TimeContextData } from "../Scope/TimeContext.js";
import { getSplittedLinearWhitespaceValues } from "../Units/lwsp.js";
import { KeySplinesAmountNotMatchingKeyTimesError } from "./KeySplinesAmountNotMatchingKeyTimesError.js";
import { KeySplinesCoordinateOutOfBoundaryError } from "./KeySplinesCoordinateOutOfBoundaryError.js";
import { KeySplinesInvalidControlsAmountError } from "./KeySplinesInvalidControlsAmountError.js";
import { KeySplinesNotAllowedError } from "./KeySplinesNotAllowedError.js";
import { KeySplinesRequiredError } from "./KeySplinesRequiredError.js";
import { KeyTimesPacedNotAllowedError } from "./KeyTimesNotAllowedError.js";

interface MetaAnimation extends Record<`tts:${string}`, string> {
	/**
	 * CalcMode is also used for <set> when we register
	 * discrete animations, in order to understand how
	 * to behave.
	 */
	calcMode: string;
	keyTimes?: string;
	keySplines?: string;
	fill?: string;
	repeatCount?: string;
	begin?: string;
	end?: string;
	dur?: string;
}

type DiscreteCalcMode = "discrete";
type ContinuousCalcMode = "linear" | "paced" | "spline";
type CalcMode = DiscreteCalcMode | ContinuousCalcMode;

interface Animation<CM extends CalcMode> {
	calcMode: CM;
	fill: "freeze" | "remove";
	repeatCount: number;
	timingAttributes: {
		begin?: string;
		end?: string;
		dur?: string;
	};
}

export const createAnimationParser = memoizationFactory(function animationParser(
	animationStorage: Map<string, unknown>,
	scope: Scope | undefined,
	attributes: MetaAnimation,
): Animation<CalcMode> | undefined {
	const calcMode = attributes["calcMode"] || "linear";

	switch (true) {
		case isDiscreteAnimation(calcMode): {
			const animation = createDiscreteAnimation(attributes, scope);

			break;
		}

		case isContinuousLinearAnimation(calcMode): {
			const animation = createLinearAnimation(attributes, scope);

			break;
		}

		case isContinuousPacedAnimation(calcMode): {
			const animation = createPacedAnimation(attributes, scope);

			break;
		}

		case isContinuousSplineAnimation(calcMode): {
			const animation = createSplineAnimation(attributes, scope);

			break;
		}
	}

	console.warn(
		"Found an animation definition with an unsupported 'calcMode' value. Allowed values are 'discrete' | 'linear' | 'paced' | 'spline'. Set is automatically considered as 'discrete'. Animation ignored.",
	);

	return undefined;
});

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

function getStyleAttributes(attributes: MetaAnimation): Record<`tts:${string}`, string> {
	return Object.fromEntries(Object.entries(attributes).filter(([key]) => isStyleAttribute(key)));
}

/**
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

/**
 * <key-splines>
 * @see https://w3c.github.io/ttml2/#animation-value-key-splines
 *
 * @param value
 * @param keyTimes
 * @returns
 */
function getKeySplines(value: string, keyTimes: number[]): number[][] {
	const splineControls = value.split(";");
	const splines: number[][] = [];

	if (splineControls.length !== keyTimes.length - 1) {
		throw new KeySplinesAmountNotMatchingKeyTimesError(splineControls.length, keyTimes.length);
	}

	for (const control of splineControls) {
		const coordinates = getSplittedLinearWhitespaceValues(control);
		const splineCoordinates = [];

		if (coordinates.length !== 4) {
			throw new KeySplinesInvalidControlsAmountError(control);
		}

		for (const coordinate of coordinates) {
			if (typeof coordinate !== "string") {
				throw new Error(
					`Invalid spline: control '${control}' parsing failed because a coordinate is not a string.`,
				);
			}

			const coordinateNumber = parseFloat(coordinate);

			if (Number.isNaN(coordinateNumber) || coordinateNumber < 0 || coordinateNumber > 1) {
				throw new KeySplinesCoordinateOutOfBoundaryError(control, coordinateNumber);
			}

			splineCoordinates.push(coordinateNumber);
		}

		splineCoordinates.push(splineCoordinates);
	}

	return splines;
}

interface DiscreteAnimation extends Animation<DiscreteCalcMode> {
	keyTimes: number[];
}

/**
 * Discrete value will happen exclusively
 * when animation is defined through `<animate>`
 * tag. `<set>` won't have this, and it is
 * discrete by design.
 *
 * @param calcMode
 * @returns
 */
function isDiscreteAnimation(calcMode: string): calcMode is DiscreteCalcMode {
	return calcMode === "discrete";
}

function createDiscreteAnimation(attributes: MetaAnimation, scope: Scope): DiscreteAnimation {
	assertKeySplinesMissing(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const timingAttributes = extractTimingAttributes(attributes);

	return {
		calcMode: "discrete",
		keyTimes: [],
		repeatCount,
		fill,
		timingAttributes,
	};
}

interface LinearAnimation extends Animation<"linear"> {
	keyTimes: number[];
}

function isContinuousLinearAnimation(calcMode: string): calcMode is "linear" {
	return calcMode === "linear";
}

function createLinearAnimation(attributes: MetaAnimation, scope: Scope): LinearAnimation {
	assertKeySplinesMissing(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const keyTimes = getKeyTimes(attributes.keyTimes, getStyleAttributes(attributes));
	const timingAttributes = extractTimingAttributes(attributes);

	return {
		calcMode: "linear",
		keyTimes,
		repeatCount,
		fill,
		timingAttributes,
	};
}

interface PacedAnimation extends Animation<"paced"> {}

function isContinuousPacedAnimation(calcMode: string): calcMode is "paced" {
	return calcMode === "paced";
}

function createPacedAnimation(attributes: MetaAnimation, scope: Scope): PacedAnimation {
	assertKeySplinesMissing(attributes);
	assertKeyTimesMissing(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const timingAttributes = extractTimingAttributes(attributes);

	return {
		calcMode: "paced",
		repeatCount,
		fill,
		timingAttributes,
	};
}

interface SplineAnimation extends Animation<"spline"> {
	keyTimes: number[];
	keySplines: number[][];
}

function isContinuousSplineAnimation(calcMode: string): calcMode is "spline" {
	return calcMode === "spline";
}

function createSplineAnimation(attributes: MetaAnimation, scope: Scope): SplineAnimation {
	assertKeySplineRequired(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const styleAttributes = getStyleAttributes(attributes);
	const keyTimes = getKeyTimes(attributes.keyTimes, styleAttributes);
	const keySplines = getKeySplines(attributes.keySplines, keyTimes);
	const timingAttributes = extractTimingAttributes(attributes);

	return {
		calcMode: "spline",
		keySplines,
		keyTimes,
		repeatCount,
		fill,
		timingAttributes,
	};
}

function assertKeySplinesMissing(
	attributes: MetaAnimation,
): asserts attributes is Omit<MetaAnimation, "keySplines"> {
	if (attributes.keySplines) {
		throw new KeySplinesNotAllowedError();
	}
}

function assertKeyTimesMissing(
	attributes: MetaAnimation,
): asserts attributes is Omit<MetaAnimation, "keyTimes"> {
	if (attributes.keyTimes) {
		throw new KeyTimesPacedNotAllowedError();
	}
}

function assertKeySplineRequired(
	attributes: MetaAnimation,
): asserts attributes is Omit<MetaAnimation, "keyTimes"> {
	if (!attributes.keySplines) {
		throw new KeySplinesRequiredError();
	}
}

function extractTimingAttributes(
	attributes: MetaAnimation,
): Omit<TimeContextData, "timeContainer"> {
	return {
		begin: attributes["begin"],
		dur: attributes["dur"],
		end: attributes["end"],
	};
}
