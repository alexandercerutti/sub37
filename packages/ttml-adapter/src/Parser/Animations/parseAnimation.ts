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

type AnimationValueList = string[];
type AnimationValueLists = {
	[key: string]: AnimationValueList;
};

/**
 * <animation-value-list>
 *
 * @see https://w3c.github.io/ttml2/#animation-value-animation-value-list
 */
function getAnimationValueLists(attributes: MetaAnimation): AnimationValueLists {
	const styles = Object.entries(attributes) as [string, string][];
	const lists: AnimationValueLists = {};

	for (const [key, value] of styles) {
		if (!isStyleAttribute(key)) {
			continue;
		}

		// <animation-value>
		const animationValues = value.split(";");
		lists[key] = animationValues;
	}

	return lists;
}

/**
 *
 * @param value
 * @param styles
 * @returns
 */
function getKeyTimes(value: string, animationValueLists: AnimationValueLists): number[] {
	const splittedKeyTimes = value.split(";").map((kt) => parseFloat(kt)) || [];
	const animationValueListsEntries = Object.entries(animationValueLists);

	if (splittedKeyTimes.length) {
		assertAllKeyTimesWithinBoundaries(splittedKeyTimes);
		assertKeyTimesBeginIsZero(splittedKeyTimes[0]);

		for (const [styleName, animationValueList] of animationValueListsEntries) {
			if (animationValueList.length === splittedKeyTimes.length) {
				continue;
			}

			throw new Error(
				`Invalid KeyTimes: the amount of keytimes (${splittedKeyTimes.length}) is different from the amount of <animation-value> for style '${styleName}'. Ignoring animation.`,
			);
		}

		return splittedKeyTimes;
	}

	let keyTimesFound = animationValueListsEntries[0][1].length;

	for (let i = 1; i < animationValueListsEntries.length; i++) {
		const animationValueList = animationValueListsEntries[i][1];

		if (animationValueList.length !== keyTimesFound) {
			const styleName = animationValueListsEntries[i][0];
			throw new Error(
				`Invalid inferred keyTimes: ${styleName} has ${animationValueList.length} <animation-value> while some have ${keyTimesFound}. All the <animation-value-list> must have the same amount of <animation-value>.`,
			);
		}
	}

	if (keyTimesFound < 2) {
		throw new Error("Invalid inferred keyTimes: at least two keyTimes are required.");
	}

	const keyTimes: number[] = [];
	const factor = 1 / (keyTimesFound - 1);

	for (let i = 0; i < keyTimesFound; i++) {
		keyTimes.push(i * factor);
	}

	return keyTimes;
}

function assertAllKeyTimesWithinBoundaries(values: number[]): void {
	let lastKeyTime = 0;

	for (const keyTime of values) {
		if (keyTime < 0 || keyTime > 1) {
			throw new Error(
				`Invalid keyTimes: keyTime component '${keyTime}' exceeds the boundary of [0, 1]. Ignored.`,
			);
		}

		if (keyTime < lastKeyTime) {
			throw new Error(
				`Invalid keyTimes: keyTime component '${keyTime}' is greater than the previous component. Ascending order is mandatory.`,
			);
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
function assertKeyTimesBeginIsZero(value: number): void {
	if (value !== 0) {
		throw new Error("Invalid keyTimes: first value is not 0.");
	}
}

function assertKeyTimesEndIsOne(value: number): void {
	if (value !== 0) {
		throw new Error("Invalid keyTimes: last value is not 1.");
	}
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
	const animationValueLists = getAnimationValueLists(attributes);
	const keyTimes = getKeyTimes(attributes["keyTimes"], animationValueLists);

	const timingAttributes = extractTimingAttributes(attributes);

	return {
		calcMode: "discrete",
		keyTimes,
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
	const animationValueLists = getAnimationValueLists(attributes);
	const keyTimes = getKeyTimes(attributes.keyTimes, animationValueLists);

	assertKeyTimesEndIsOne(keyTimes[keyTimes.length - 1]);

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
	const animationValueLists = getAnimationValueLists(attributes);
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
	const animationValueLists = getAnimationValueLists(attributes);
	const keyTimes = getKeyTimes(attributes.keyTimes, animationValueLists);

	assertKeyTimesEndIsOne(keyTimes[keyTimes.length - 1]);

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
