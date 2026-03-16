import { memoizationFactory } from "../memoizationFactory.js";
import {
	isPropertyContinuouslyAnimatable,
	isPropertyDiscretelyAnimatable,
	isStyleAttribute,
	parseAttributeValue,
	resolveStyleDefinitionByName,
} from "../parseStyle.js";
import type { Scope } from "../Scope/Scope";
import type { TimeContextData } from "../Scope/TimeContext.js";
import type { DerivedValue } from "../Style/structure/operators.js";
import { getKeySplines } from "./keySplines/index.js";
import type { Spline } from "./keySplines/index.js";
import { KeySplinesNotAllowedError } from "./keySplines/KeySplinesNotAllowedError.js";
import { KeySplinesRequiredError } from "./keySplines/KeySplinesRequiredError.js";
import {
	assertKeyTimesEndIsOne,
	getInferredPacedKeyTimesByAmount,
	getKeyTimes,
} from "./keyTimes/index.js";
import { KeyTimesPacedNotAllowedError } from "./keyTimes/KeyTimesNotAllowedError.js";

interface MetaAnimation extends Record<`tts:${string}`, string> {
	"xml:id"?: string;
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

export type CalcMode = DiscreteCalcMode | ContinuousCalcMode;

interface BaseAnimation {
	id: string;
	fill: "freeze" | "remove";
	repeatCount: number;
	timingAttributes: {
		begin?: string;
		end?: string;
		dur?: string;
	};
	keyTimes: number[];
	stylesFrames: Map<string, DerivedValue<string, unknown>[][]>;
}

export type Animation = DiscreteAnimation | LinearAnimation | PacedAnimation | SplineAnimation;

export const createAnimationParser = memoizationFactory(function animationParser(
	animationStorage: Map<string, Animation>,
	_scope: Scope,
	/**
	 * CalcMode is also used for <set> when we register
	 * discrete animations, in order to understand how
	 * to behave.
	 */
	calcMode: CalcMode,
	attributes: Record<string, string>,
): Animation | undefined {
	const animationId = attributes["xml:id"] || `animation__${Math.random() * (1000 - 10) + 10}`;

	if (animationStorage.has(animationId)) {
		return undefined;
	}

	let animation: Animation;

	try {
		switch (true) {
			case isDiscreteAnimation(calcMode): {
				animation = createDiscreteAnimation(animationId, attributes);
				break;
			}

			case isContinuousLinearAnimation(calcMode): {
				animation = createLinearAnimation(animationId, attributes);
				break;
			}

			case isContinuousPacedAnimation(calcMode): {
				animation = createPacedAnimation(animationId, attributes);
				break;
			}

			case isContinuousSplineAnimation(calcMode): {
				animation = createSplineAnimation(animationId, attributes);
				break;
			}

			default: {
				console.warn(
					"Found an animation definition with an unsupported 'calcMode' value. Allowed values are 'discrete' | 'linear' | 'paced' | 'spline'. Set is automatically considered as 'discrete'. Animation ignored.",
				);

				return undefined;
			}
		}
	} catch (err) {
		console.warn(
			`An error occurred while parsing an animation definition: ${err}. Animation ignored.`,
		);

		return undefined;
	}

	const animationValueList = getAnimationValueListByStyleName(attributes);
	const stylesFrames = getValidAnimationParsedStylesFrames(
		calcMode === "discrete" ? "discrete" : "continuous",
		animationValueList,
		animation.keyTimes.length,
	);

	if (!animation.keyTimes.length) {
		const [stylesToDiscard, keyTimesAmount] =
			collectPropertiesWithIncoherentInferredKeyTimesAmount(stylesFrames);

		for (const discardedStyle of stylesToDiscard) {
			stylesFrames.delete(discardedStyle);
			console.warn(
				`Invalid inferred keyTimes: ${discardedStyle} has an incoherent amount of keyframes compared to other styles in the animation. Ignored.`,
			);
		}

		animation.keyTimes = getInferredPacedKeyTimesByAmount(keyTimesAmount);
	}

	assertKeyTimesEndIsOne(animation.keyTimes[animation.keyTimes.length - 1]);

	if (!stylesFrames.size) {
		return undefined;
	}

	for (const [styleName, frames] of stylesFrames) {
		animation.stylesFrames.set(styleName, frames);
	}

	animationStorage.set(animationId, animation);

	return animation;
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
 * Please note that animation-value-list might be defined as follows as well
 * for multi-components attributes, like `tts:border`:
 *
 * ```
 * tts:border="2px red; green; blue"
 * ```
 *
 * or
 *
 * ```xml
 * <p tts:border="2x solid">
 * 	<animate tts:border="red; green; blue"/>
 * 	<span>
 * 		A paragraph with a 2px, solid border with a linear animated border color
 * 		transitioning from red to green to blue
 * 		over implied keyTimes="0;0.5;1".
 * 	</span>
 * </p>
 * ```
 *
 * Both of these cases define that there is a default value for `2px solid` (width and style)
 * and that they do not need to be re-defined in the animation values.
 *
 * The grammar system, as was designed, is not able to handle this case yet because it is strict
 * according to the syntax definitions. Supporting these cases would require a more complex system
 * that could bypass derivation rejections when checking for animations.
 *
 * So, in order to correctly support animations, full properties will need to be defined in each keyframe.
 *
 * Furthermore, this behavior is not explicitly defined in the TTML2 specification but rather in the
 * the emails I exchanged in the W3C TTML mailing list.
 *
 * @see https://lists.w3.org/Archives/Public/public-tt/2025Mar/0001.html
 *
 * @param animatableStyle
 * @param animationValueListByStyleName
 * @param expectedKeytimes
 * @returns
 */
function getValidAnimationParsedStylesFrames(
	animatableStyle: "discrete" | "continuous",
	animationValueListByStyleName: AnimationValueListByStyleName,
	expectedKeytimes: number,
): Map<string, DerivedValue[][]> {
	const stylesMap = new Map<string, DerivedValue[][]>();

	animationValueListsLoop: for (const [name, animationValueList] of animationValueListByStyleName) {
		if (!isStyleAnimationCompatible(animatableStyle, name)) {
			continue;
		}

		const animationValue = splitAnimationValueList(animationValueList);

		if (animationValue.length <= 1) {
			continue animationValueListsLoop;
		}

		if (expectedKeytimes > 0 && expectedKeytimes !== animationValue.length) {
			console.warn(
				`Style '${name}' was specified as animation-value, but the amount of keyTimes (${expectedKeytimes}) does not match the amount of specified animation values (${animationValue.length}). Ignored.`,
			);

			continue animationValueListsLoop;
		}

		const keyframes: DerivedValue[][] = [];
		const attribute = resolveStyleDefinitionByName(name);
		const Syntax = attribute.syntax;

		for (const value of animationValue) {
			const parsingOutcome = parseAttributeValue(Syntax, value);

			if (parsingOutcome === null) {
				// Attribute is invalid. Skip entire style.
				continue animationValueListsLoop;
			}

			keyframes.push(parsingOutcome.filter((v): v is DerivedValue => Boolean(v)));
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
		stylesMap.set(name, existingStyles);
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

interface DiscreteAnimation extends BaseAnimation {
	calcMode: "discrete";
	keySplines: [];
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
	animationId: string,
	attributes: MetaAnimation,
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
		stylesFrames: new Map(),
		keySplines: [],
	};
}

// region calcMode:linear

/**
 * keySplines in a linear animation are just a linear sequence of numbers
 * to be remapped to a cubic-bezier function.
 */
interface LinearAnimation extends BaseAnimation {
	calcMode: "linear";
	keySplines: Spline[];
}

function isContinuousLinearAnimation(calcMode: string): calcMode is "linear" {
	return calcMode === "linear";
}

function createLinearAnimation(animationId: string, attributes: MetaAnimation): LinearAnimation {
	assertKeySplinesMissing(attributes);

	const timingAttributes = extractTimingAttributes(attributes);

	return {
		id: animationId,
		calcMode: "linear",
		keyTimes: getKeyTimes(attributes.keyTimes),
		repeatCount: getRepeatCount(attributes["repeatCount"]),
		fill: getFill(attributes["fill"]),
		timingAttributes,
		stylesFrames: new Map(),
		get keySplines() {
			return this.keyTimes.map(() => [0, 0, 1, 1]) as Spline[];
		},
	};
}

// region calcMode:paced

/**
 * keySplines in a paced animation are just a linear sequence of numbers
 * to be remapped to a cubic-bezier function, which is valid for linear animations as well.
 */
interface PacedAnimation extends BaseAnimation {
	calcMode: "paced";
	keySplines: Spline[];
}

function isContinuousPacedAnimation(calcMode: string): calcMode is "paced" {
	return calcMode === "paced";
}

function createPacedAnimation(animationId: string, attributes: MetaAnimation): PacedAnimation {
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
		stylesFrames: new Map(),
		get keySplines() {
			return this.keyTimes.map(() => [0, 0, 1, 1]) as Spline[];
		},
	};
}

// region calcMode:spline

interface SplineAnimation extends BaseAnimation {
	calcMode: "spline";
	keySplines: Spline[];
}

function isContinuousSplineAnimation(calcMode: string): calcMode is "spline" {
	return calcMode === "spline";
}

function createSplineAnimation(animationId: string, attributes: MetaAnimation): SplineAnimation {
	assertKeySplineRequired(attributes);

	const keyTimes = getKeyTimes(attributes.keyTimes);
	const keySplines = getKeySplines(attributes["keySplines"], keyTimes);
	const timingAttributes = extractTimingAttributes(attributes);

	return {
		id: animationId,
		calcMode: "spline",
		keyTimes,
		repeatCount: getRepeatCount(attributes["repeatCount"]),
		fill: getFill(attributes["fill"]),
		timingAttributes,
		stylesFrames: new Map(),
		keySplines,
	};
}

/**
 * Takes the first style and uses it as reference for the other
 * styles, which should have the same amount of keyframes. If some styles
 * do not have the same amount of keyframes, they are discarded.
 *
 * @param stylesFrames
 * @returns
 */
function collectPropertiesWithIncoherentInferredKeyTimesAmount(
	stylesFrames: Map<string, DerivedValue[][]>,
): [properties: string[], keyTimes: number] {
	const keyFrameIncoherencyDiscardedStyles: string[] = [];

	let firstItemKeyframesAmount = 0;

	for (const [name, frames] of stylesFrames) {
		const amountOfKeyframes = frames.length;

		if (firstItemKeyframesAmount === 0) {
			firstItemKeyframesAmount = amountOfKeyframes;
			continue;
		}

		if (firstItemKeyframesAmount !== amountOfKeyframes) {
			keyFrameIncoherencyDiscardedStyles.push(name);
		}
	}

	return [keyFrameIncoherencyDiscardedStyles, firstItemKeyframesAmount];
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
): asserts attributes is MetaAnimation & { keySplines: string } {
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
