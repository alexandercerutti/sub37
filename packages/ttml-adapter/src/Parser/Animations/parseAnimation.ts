import { memoizationFactory } from "../memoizationFactory.js";
import {
	createStyleParser,
	isPropertyContinuouslyAnimatable,
	isPropertyDiscretelyAnimatable,
	isStyleAttribute,
	TTMLStyle,
} from "../parseStyle.js";
import type { Scope } from "../Scope/Scope";
import { TimeContextData } from "../Scope/TimeContext.js";
import { getKeySplines } from "./keySplines/index.js";
import { KeySplinesNotAllowedError } from "./keySplines/KeySplinesNotAllowedError.js";
import { KeySplinesRequiredError } from "./keySplines/KeySplinesRequiredError.js";
import { assertKeyTimesEndIsOne, getKeyTimes } from "./keyTimes/index.js";
import { KeyTimesPacedNotAllowedError } from "./keyTimes/KeyTimesNotAllowedError.js";

type StyleParser = ReturnType<typeof createStyleParser>;

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
	const styleParser = createStyleParser(scope);
	const calcMode = attributes["calcMode"] || "linear";

	switch (true) {
		case isDiscreteAnimation(calcMode): {
			const animation = createDiscreteAnimation(attributes, styleParser);

			break;
		}

		case isContinuousLinearAnimation(calcMode): {
			const animation = createLinearAnimation(attributes, styleParser);

			break;
		}

		case isContinuousPacedAnimation(calcMode): {
			const animation = createPacedAnimation(attributes, styleParser);

			break;
		}

		case isContinuousSplineAnimation(calcMode): {
			const animation = createSplineAnimation(attributes, styleParser);

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

export type AnimationValueList = string[];
export type AnimationValueListMap = Map<string, AnimationValueList>;

/**
 * <animation-value-list>
 *
 * @see https://w3c.github.io/ttml2/#animation-value-animation-value-list
 */
function getAnimationValueLists(attributes: MetaAnimation): AnimationValueListMap {
	const styles = Object.entries(attributes) as [string, string][];
	const lists: AnimationValueListMap = new Map();

	for (const [key, value] of styles) {
		if (!isStyleAttribute(key)) {
			continue;
		}

		// <animation-value>
		const animationValues = value.split(";");
		lists.set(key, animationValues);
	}

	return lists;
}

/**
 * Verifies if a property is animatable and converts the
 * <animation-value> into a list of TTMLStyles.
 *
 * @param animationValueLists
 * @param styleParser
 * @returns
 */
function getStylesFrameListMap(
	animationValueLists: AnimationValueListMap,
	styleParser: StyleParser,
): Map<string, TTMLStyle[]> {
	const styleMap = new Map<string, TTMLStyle[]>();

	for (const [name, animationValueList] of animationValueLists) {
		const isAnimatable =
			isPropertyDiscretelyAnimatable(name) || isPropertyContinuouslyAnimatable(name);

		if (!isAnimatable) {
			/**
			 * "Targeting a non-animatable style is considered an error and
			 * must be ignored for the purpose of presentation processing."
			 */
			console.warn(
				`Style '${name}' was specified as animation-value, but is not animatable. Ignored.`,
			);
			continue;
		}

		if (!styleMap.has(name)) {
			styleMap.set(name, []);
		}

		const styleList = styleMap.get(name);

		for (const animationValue of animationValueList) {
			const style = styleParser.process({
				[name]: animationValue,
			});

			styleList.push(style);
		}
	}

	return styleMap;
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

function createDiscreteAnimation(
	attributes: MetaAnimation,
	styleParser: StyleParser,
): DiscreteAnimation {
	assertKeySplinesMissing(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const animationValueLists = getAnimationValueLists(attributes);
	const stylesFrameListMap = getStylesFrameListMap(animationValueLists, styleParser);
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

function createLinearAnimation(
	attributes: MetaAnimation,
	styleParser: StyleParser,
): LinearAnimation {
	assertKeySplinesMissing(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const animationValueLists = getAnimationValueLists(attributes);
	const stylesFrameListMap = getStylesFrameListMap(animationValueLists, styleParser);
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

function createPacedAnimation(attributes: MetaAnimation, styleParser: StyleParser): PacedAnimation {
	assertKeySplinesMissing(attributes);
	assertKeyTimesMissing(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const animationValueLists = getAnimationValueLists(attributes);
	const stylesFrameListMap = getStylesFrameListMap(animationValueLists, styleParser);
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

function createSplineAnimation(
	attributes: MetaAnimation,
	styleParser: StyleParser,
): SplineAnimation {
	assertKeySplineRequired(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const animationValueLists = getAnimationValueLists(attributes);
	const stylesFrameListMap = getStylesFrameListMap(animationValueLists, styleParser);

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
