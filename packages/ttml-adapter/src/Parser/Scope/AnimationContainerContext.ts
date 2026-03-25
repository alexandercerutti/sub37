import type { Context, ContextFactory, Scope } from "./Scope.js";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import { isUniquelyAnnotatedNode, UniquelyAnnotatedNode } from "../Token.js";
import { isPropertyContinuouslyAnimatable, isPropertyDiscretelyAnimatable, isStyleAttribute, parseAttributeValue, resolveStyleDefinitionByName, styleAppliesToElement } from "../parseStyle.js";
import type { DiscreteAnimation } from "../Animations/calcMode/discrete.js";
import type { LinearAnimation } from "../Animations/calcMode/linear.js";
import type { PacedAnimation } from "../Animations/calcMode/paced.js";
import type { SplineAnimation } from "../Animations/calcMode/spline.js";
import type { CalcModeFactory } from "../Animations/calcMode/factory.js";
import { getAnimationFactoryByCalcMode } from "../Animations/calcMode/factory.js";
import type { DerivedValue } from "../Style/structure/operators.js";
import { assertKeyTimesEndIsOne, getInferredPacedKeyTimesByAmount } from "../Animations/keyTimes/index.js";

export interface BaseAnimation {
	id: string;
	fill: "freeze" | "remove";
	repeatCount: number;
	calcMode: string;
	timingAttributes: {
		begin?: string;
		end?: string;
		dur?: string;
	};
	keyTimes: number[];
}

export type Animation = (DiscreteAnimation | LinearAnimation | PacedAnimation | SplineAnimation) & {
	apply(element: string): Record<string, string[]>;
};

const animationContextSymbol = Symbol("animations");

export interface AnimationContainerContextState {
	calcMode: string | undefined;
	attributes: Record<string, string>;
}

interface AnimationContainerContext extends Context<
	AnimationContainerContext,
	AnimationContainerContextState[]
> {
	get animations(): Animation[];
	getAnimationById(id: string | undefined): Animation | undefined;
}

declare module "./Scope" {
	interface ContextDictionary {
		[animationContextSymbol]: AnimationContainerContext;
	}
}

export function createAnimationContainerContext(
	contextState: AnimationContainerContextState[],
): ContextFactory<AnimationContainerContext> {
	return function (scope: Scope) {
		if (!contextState.length) {
			return null;
		}

		const animationsIDREFSStorage = new Map<string, Animation>();

		return {
			parent: undefined,
			identifier: animationContextSymbol,
			get args() {
				return contextState;
			},
			[onAttachedSymbol](): void {
				for (const { calcMode = "linear", attributes } of contextState) {
					if (!isUniquelyAnnotatedNode(attributes)) {
						console.warn(
							"Animation with unknown 'xml:id' attribute, got ignored.",
						);
						continue;
					}

					if (animationsIDREFSStorage.has(attributes["xml:id"])) {
						console.warn(
							`Animation with duplicate 'xml:id' attribute (${attributes["xml:id"]}), got ignored.`,
						);
						continue;
					}

					const calcModeFactory = getAnimationFactoryByCalcMode(calcMode);
					const animation = createAnimation(calcModeFactory, attributes, scope);

					if (!animation) {
						continue;
					}

					animationsIDREFSStorage.set(attributes["xml:id"], animation);
				}
			},
			[onMergeSymbol](incomingContext: AnimationContainerContext): void {
				const { args } = incomingContext;

				for (const { calcMode = "linear", attributes } of args) {
					if (!isUniquelyAnnotatedNode(attributes)) {
						console.warn(
							"Animation with unknown 'xml:id' attribute, got ignored.",
						);
						continue;
					}

					if (animationsIDREFSStorage.has(attributes["xml:id"])) {
						console.warn(
							`Animation with duplicate 'xml:id' attribute (${attributes["xml:id"]}), got ignored.`,
						);
						continue;
					}

					const calcModeFactory = getAnimationFactoryByCalcMode(calcMode);
					const animation = createAnimation(calcModeFactory, attributes, scope);

					if (!animation) {
						continue;
					}

					animationsIDREFSStorage.set(attributes["xml:id"], animation);
				}
			},
			getAnimationById(id: string | undefined): Animation | undefined {
				if (!id?.length) {
					return undefined;
				}

				return animationsIDREFSStorage.get(id) ?? this.parent?.getAnimationById(id);
			},
			get animations(): Animation[] {
				return Array.from(animationsIDREFSStorage.values()).concat(
					this.parent?.animations ?? [],
				);
			},
		};
	};
}

export function readScopeAnimationContext(scope: Scope): AnimationContainerContext | undefined {
	return scope.getContextByIdentifier(animationContextSymbol);
}

function createAnimation(calcModeFactory: CalcModeFactory, attributes: Record<string, string> & UniquelyAnnotatedNode, scope: Scope): Animation | undefined {
	const animationId = attributes["xml:id"];

	let animation: BaseAnimation | undefined;
	
	try {		
		animation = calcModeFactory(animationId, attributes);
	
		if (!animation) {
			return undefined;
		}
	} catch (err) {
		console.warn(
			`An error occurred while parsing an animation definition: ${err}. Animation ignored.`,
		);

		return undefined;
	}

	const animationValueList = getAnimationValueListByStyleName(attributes);
		const stylesFrames = getValidAnimationParsedStylesFrames(
			animation.calcMode === "discrete" ? "discrete" : "continuous",
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
	
		assertKeyTimesEndIsOne(animation.keyTimes);
	
		if (!stylesFrames.size) {
			return undefined;
		}
	
		const animationWithStyles: Animation = Object.create(animation, {
			apply: {
				value(element: string) {
					return convertAnimationStylesToCSS(stylesFrames, scope, element);
				},
			},
		});
	
	return animationWithStyles;
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

function convertAnimationStylesToCSS(
	stylesFrames: Map<string, DerivedValue[][]>,
	scope: Scope,
	sourceElementName: string,
): Record<string, string[]> {
	const result: Record<string, string[]> = {};

	for (const [ttmlProperty, keyframes] of stylesFrames) {
		const definition = resolveStyleDefinitionByName(ttmlProperty);

		if (!definition || !styleAppliesToElement(definition, scope, sourceElementName)) {
			continue;
		}

		for (const derivedValues of keyframes) {
			const mapped = definition.toCSS(scope, derivedValues, sourceElementName);

			if (mapped === null) {
				continue;
			}

			for (const [cssKey, cssValue] of mapped) {
				if (!result[cssKey]) {
					result[cssKey] = [];
				}

				result[cssKey].push(cssValue);
			}
		}
	}

	return result;
}

function splitAnimationValueList(animationValue: AnimationValueList): AnimationValue[] {
	return animationValue.split(/\s*;\s*/);
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
	attributes: Record<string, string>,
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
