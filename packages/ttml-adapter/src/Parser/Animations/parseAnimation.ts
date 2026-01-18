import { memoizationFactory } from "../memoizationFactory.js";
import {
	createStyleParser,
	isPropertyContinuouslyAnimatable,
	isPropertyDiscretelyAnimatable,
	isStyleAttribute,
	parseAttributeValue,
	resolveStyleDefinitionByName,
} from "../parseStyle.js";
import type { TTMLStyle } from "../parseStyle.js";
import type { Scope } from "../Scope/Scope";
import type { TimeContextData } from "../Scope/TimeContext.js";
import type { DerivedValue } from "../Style/structure/operators.js";
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
	scope: Scope,
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

function getRepeatCount(value: "indefinite" | string | undefined): number {
	if (!value) {
		return 1;
	}

	if (value === "indefinite") {
		return Infinity;
	}

	const parsed = parseFloat(value);

	return Math.max(1, parsed);
}

function getFill(value: string | undefined): "freeze" | "remove" {
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
 * \<animation-value>
 *
 * A list of one or more values that were separated by semicolons.
 * An array of this, should be interpreted as the list of keyframes
 * processed as splitted by semicolons.
 *
 * @see https://w3c.github.io/ttml2/#animation-value-animation-value
 */
type AnimationValue = string;

/**
 * \<animation-value-list>
 *
 * A list of one or more \<animation-value> entries separated by semicolons.
 *
 * @see https://w3c.github.io/ttml2/#animation-value-animation-value-list
 */
type AnimationValueList = string;

export type AnimationValueListByStyleName = Map<`tts:${string}`, AnimationValueList>;

function getAnimationValueListByStyleName(
	attributes: MetaAnimation,
): AnimationValueListByStyleName {
	const animationValueListByStyleName: AnimationValueListByStyleName = new Map();

	for (const [attributeName, attributeValue] of Object.entries(attributes)) {
		if (!isStyleAttribute(attributeName)) {
			continue;
		}

		animationValueListByStyleName.set(attributeName, attributeValue);
	}

	return animationValueListByStyleName;
}

/**
 * Splits and validates animations for styles. Discards invalid animations
 * for styles that are not animatable or not compatible with the specified
 * animatable style.
 *
 * @param animatableStyle
 * @param animationValueListByStyleName
 * @returns
 */
function getValidAnimationParsedStyles(
	animatableStyle: "discrete" | "continuous",
	animationValueListByStyleName: AnimationValueListByStyleName,
	// scope: Scope,
): Map<string, DerivedValue[]> {
	const stylesMap = new Map<string, DerivedValue[]>();

	animationValueListsLoop: for (const [name, animationValueList] of animationValueListByStyleName) {
		if (!isStyleAnimationCompatible(animatableStyle, name)) {
			continue;
		}

		const animationValue = splitAnimationValueList(animationValueList);

		/**
		 * @TODO should we receive keyTimes and check here the amount or
		 * should we do that outside?
		 */

		const keyframes: DerivedValue[] = [];
		const attribute = resolveStyleDefinitionByName(name);
		const Syntax = attribute.syntax;

		for (const value of animationValue) {
			const parsingOutcome = parseAttributeValue(Syntax, value);

			if (parsingOutcome === null) {
				// Attribute is invalid. Skip entire style.
				continue animationValueListsLoop;
			}

			keyframes.push(...parsingOutcome.filter((v): v is DerivedValue => Boolean(v)));
		}

		if (typeof Syntax.validateAnimation === "function") {
			const isAnimationValid = Syntax.validateAnimation(keyframes, animatableStyle);

			if (!isAnimationValid) {
				// Attribute is invalid. Skip entire style.
				continue animationValueListsLoop;
			}
		}

		const existingStyles = stylesMap.get(name) || [];
		existingStyles.push(...keyframes);
	}

	return stylesMap;
}

function isStyleAnimationCompatible(
	animatableStyle: "discrete" | "continuous",
	styleName: `tts:${string}`,
): boolean {
	const isAnimatableDiscretely = isPropertyDiscretelyAnimatable(styleName);
	const isAnimatableContinuously = isPropertyContinuouslyAnimatable(styleName);

	const isAnimatable = isAnimatableDiscretely || isAnimatableContinuously;

	if (!isAnimatable) {
		/**
		 * "Targeting a non-animatable style is considered an error and
		 * must be ignored for the purpose of presentation processing."
		 */
		console.warn(
			`Style '${styleName}' was specified as animation-value, but is not animatable. Ignored.`,
		);

		return false;
	}

	if (animatableStyle === "discrete" && !isAnimatableDiscretely) {
		console.warn(
			`Style '${styleName}' was specified as animation-value with a continuous animatable style, but is not discretely animatable. Ignored.`,
		);

		return false;
	}

	return true;
}

function splitAnimationValueList(animationValue: AnimationValueList): AnimationValue[] {
	return animationValue.split(/\s*;\s*/);
}

// region calcMode:discrete

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
	const animationValueList = getAnimationValueListByStyleName(attributes);
	const animationStyles = getValidAnimationParsedStyles("discrete", animationValueList);

	const keyTimes = getKeyTimes(attributes["keyTimes"], animationValueList);

	const timingAttributes = extractTimingAttributes(attributes);

	return {
		calcMode: "discrete",
		keyTimes,
		repeatCount,
		fill,
		timingAttributes,
	};
}

// region calcMode:linear

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
	const animationValueList = getAnimationValueListByStyleName(attributes);
	const animationStyles = getValidAnimationParsedStyles("continuous", animationValueList);

	const keyTimes = getKeyTimes(attributes.keyTimes, animationValueList);

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

// region calcMode:paced

interface PacedAnimation extends Animation<"paced"> {}

function isContinuousPacedAnimation(calcMode: string): calcMode is "paced" {
	return calcMode === "paced";
}

function createPacedAnimation(attributes: MetaAnimation, styleParser: StyleParser): PacedAnimation {
	assertKeySplinesMissing(attributes);
	assertKeyTimesMissing(attributes);

	const repeatCount = getRepeatCount(attributes["repeatCount"]);
	const fill = getFill(attributes["fill"]);
	const animationValueList = getAnimationValueListByStyleName(attributes);
	const animationStyles = getValidAnimationParsedStyles("continuous", animationValueList);

	const timingAttributes = extractTimingAttributes(attributes);

	return {
		calcMode: "paced",
		repeatCount,
		fill,
		timingAttributes,
	};
}

// region calcMode:spline

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
	const animationValueList = getAnimationValueListByStyleName(attributes);
	const animationStyles = getValidAnimationParsedStyles("continuous", animationValueList);

	const keyTimes = getKeyTimes(attributes.keyTimes, animationValueList);

	assertKeyTimesEndIsOne(keyTimes[keyTimes.length - 1]);

	const keySplines = getKeySplines(attributes["keySplines"], keyTimes);

	/**
	 * @TODO validate keySplines, if they are not provided correctly
	 */

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
