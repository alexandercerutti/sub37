import type { Context, ContextFactory, Scope } from "./Scope.js";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import type { UniquelyAnnotatedNode } from "../namespaces/xml/id.js";
import { isUniquelyAnnotatedNode } from "../namespaces/xml/id.js";
import {
	isInheritableStyle,
	isPropertyContinuouslyAnimatable,
	isPropertyDiscretelyAnimatable,
	isStyleAttribute,
	resolveStyleDefinitionByName,
	styleAppliesToElement,
} from "../parseStyle.js";
import type { SyntaxModuleDefinition } from "../parseStyle.js";
import { parseAttributeValue } from "../grammar/parseAttributeValue.js";
import type { DiscreteAnimation } from "../Animations/calcMode/discrete.js";
import type { LinearAnimation } from "../Animations/calcMode/linear.js";
import type { PacedAnimation } from "../Animations/calcMode/paced.js";
import type { SplineAnimation } from "../Animations/calcMode/spline.js";
import type { CalcModeFactory } from "../Animations/calcMode/factory.js";
import { getAnimationFactoryByCalcMode } from "../Animations/calcMode/factory.js";
import type { DerivedValue } from "../namespaces/tts/structure/operators.js";
import {
	assertKeyTimesEndIsOne,
	getInferredPacedKeyTimesByAmount,
} from "../Animations/keyTimes/index.js";
import { readScopeErrorContext } from "./ErrorContext.js";

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
	element: "set" | "animate";
	calcMode: string | undefined;

	/**
	 * Each inline animation is assigned to a specific element.
	 * When the parent element (assignee element) is a region,
	 * we have to determine whether its styles can be forwarded
	 * to elements that flowed inside it by inheritance. Not all
	 * of the styles can.
	 */
	ownerElement: string;

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

		const errorContext = readScopeErrorContext(scope)!;

		const animationsIDREFSStorage = new Map<string, Animation>();

		return {
			parent: undefined,
			identifier: animationContextSymbol,
			get args() {
				return contextState;
			},
			[onAttachedSymbol](): void {
				for (const { calcMode = "linear", attributes, element, ownerElement } of contextState) {
					try {
						/**
						 * Both sets and animate will get assigned a synthetic "xml:id" on parse,
						 * so this might be a dead branch
						 */
						if (!isUniquelyAnnotatedNode(attributes)) {
							errorContext.report(
								new Error("Animation with unknown 'xml:id' attribute, got ignored."),
								false,
							);
							continue;
						}

						if (animationsIDREFSStorage.has(attributes["xml:id"])) {
							errorContext.report(
								new Error(
									`Animation with duplicate 'xml:id' attribute (${attributes["xml:id"]}), got ignored.`,
								),
								false,
							);
							continue;
						}

						const calcModeFactory = getAnimationFactoryByCalcMode(calcMode);
						const animation = createAnimation(
							calcModeFactory,
							attributes,
							element,
							ownerElement,
							scope,
						);

						if (!animation) {
							continue;
						}

						animationsIDREFSStorage.set(attributes["xml:id"], animation);
					} catch (err) {
						errorContext.report(err instanceof Error ? err : new Error(String(err)), false);
					}
				}
			},
			[onMergeSymbol](incomingContext: AnimationContainerContext): void {
				const { args } = incomingContext;

				for (const { calcMode = "linear", attributes, element, ownerElement } of args) {
					try {
						/**
						 * Both sets and animate will get assigned a synthetic "xml:id" on parse,
						 * so this might be a dead branch
						 */
						if (!isUniquelyAnnotatedNode(attributes)) {
							errorContext.report(
								new Error("Animation with unknown 'xml:id' attribute, got ignored."),
								false,
							);
							continue;
						}

						if (animationsIDREFSStorage.has(attributes["xml:id"])) {
							errorContext.report(
								new Error(
									`Animation with duplicate 'xml:id' attribute (${attributes["xml:id"]}), got ignored.`,
								),
								false,
							);
							continue;
						}

						const calcModeFactory = getAnimationFactoryByCalcMode(calcMode);
						const animation = createAnimation(
							calcModeFactory,
							attributes,
							element,
							ownerElement,
							scope,
						);

						if (!animation) {
							continue;
						}

						animationsIDREFSStorage.set(attributes["xml:id"], animation);
					} catch (err) {
						errorContext.report(err instanceof Error ? err : new Error(String(err)), false);
					}
				}
			},
			getAnimationById(id: string | undefined): Animation | undefined {
				if (!id?.length) {
					return undefined;
				}

				return animationsIDREFSStorage.get(id) ?? this.parent?.getAnimationById(id);
			},
			get animations(): Animation[] {
				return Array.from(animationsIDREFSStorage.values()).concat(this.parent?.animations ?? []);
			},
		};
	};
}

export function readScopeAnimationContext(scope: Scope): AnimationContainerContext | undefined {
	return scope.getContextByIdentifier(animationContextSymbol);
}

function createAnimation(
	calcModeFactory: CalcModeFactory,
	attributes: Record<string, string> & UniquelyAnnotatedNode,
	sourceElement: "set" | "animate",
	ownerElement: string,
	scope: Scope,
): Animation | undefined {
	const animationId = attributes["xml:id"];
	const errorContext = readScopeErrorContext(scope)!;

	let animation: BaseAnimation | undefined;

	try {
		animation = calcModeFactory(animationId, attributes);

		if (!animation) {
			return undefined;
		}
	} catch (err) {
		errorContext.report(
			err instanceof Error
				? err
				: new Error(
						`An error occurred while parsing an animation definition: ${err}. Animation ignored.`,
					),
			false,
		);

		return undefined;
	}

	const animationValueList = getAnimationValueListByStyleName(attributes);
	const stylesFrames = getValidAnimationParsedStylesFrames(
		sourceElement,
		animation.calcMode === "discrete" ? "discrete" : "continuous",
		animationValueList,
		animation.keyTimes.length,
		(error) => errorContext.report(error, false),
	);

	if (!animation.keyTimes.length) {
		const [stylesToDiscard, keyTimesAmount] =
			collectPropertiesWithIncoherentInferredKeyTimesAmount(stylesFrames);

		for (const discardedStyle of stylesToDiscard) {
			stylesFrames.delete(discardedStyle);
			errorContext.report(
				new Error(
					`Invalid inferred keyTimes: ${discardedStyle} has an incoherent amount of keyframes compared to other styles in the animation. Ignored.`,
				),
				false,
			);
		}

		animation.keyTimes = getInferredPacedKeyTimesByAmount(keyTimesAmount);
	}

	assertKeyTimesEndIsOne(animation.keyTimes);

	if (!stylesFrames.size) {
		return undefined;
	}

	const animationWithStyles: Animation = Object.create(animation, {
		cachedStylesByElement: {
			value: new Map<string, Record<string, string>>(),
		},
		apply: {
			value(element: string): Record<string, string[]> {
				if (this.cachedStylesByElement.has(`${ownerElement}-${element}`)) {
					return this.cachedStylesByElement.get(`${ownerElement}-${element}`)!;
				}

				const styles = convertAnimationStylesToCSS(stylesFrames, scope, ownerElement, element);
				this.cachedStylesByElement.set(`${ownerElement}-${element}`, styles);
				return styles;
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
	elementSource: "animate" | "set",
	animatableStyle: "discrete" | "continuous",
	animationValueListByStyleName: AnimationValueListByStyleName,
	expectedKeytimes: number,
	reportError: (error: Error) => void,
): Map<string, DerivedValue[][]> {
	const stylesMap = new Map<string, DerivedValue[][]>();

	animationValueListsLoop: for (const [name, animationValueList] of animationValueListByStyleName) {
		if (!isStyleAnimationCompatible(animatableStyle, name, reportError)) {
			continue;
		}

		const animationValue = splitAnimationValueList(animationValueList);

		if (elementSource === "set" && animationValue.length > 1) {
			reportError(
				new Error(`<set> element styles can't have multiple values. Animation value ignored.`),
			);
			continue animationValueListsLoop;
		}

		if (animationValue.length === 1 && animatableStyle === "discrete") {
			/**
			 * <set> produces a single target value with no semicolons.
			 * Duplicate it to create a two-keyframe hold: the value
			 * is set at 0% and held through 100% of the active duration.
			 */
			animationValue.push(animationValue[0]!);
		} else if (animationValue.length <= 1) {
			continue animationValueListsLoop;
		}

		if (expectedKeytimes > 0 && expectedKeytimes !== animationValue.length) {
			reportError(
				new Error(
					`Style '${name}' was specified as animation-value, but the amount of keyTimes (${expectedKeytimes}) does not match the amount of specified animation values (${animationValue.length}). Ignored.`,
				),
			);

			continue animationValueListsLoop;
		}

		const keyframes: (DerivedValue | undefined)[][] = [];
		const attribute = resolveStyleDefinitionByName(name);

		if (!attribute) {
			reportError(
				new Error(
					`Style '${name}' was specified as animation-value, but no definition was found for it. Ignored.`,
				),
			);

			continue animationValueListsLoop;
		}

		const Syntax: SyntaxModuleDefinition = attribute.syntax;

		for (const value of animationValue) {
			try {
				const parsingOutcome = parseAttributeValue(Syntax, value);

				keyframes.push(parsingOutcome);
			} catch (err) {
				// Attribute is invalid. Skip entire style.
				reportError(
					err instanceof Error
						? err
						: new Error(
								`An error occurred while parsing animation value '${value}' for style '${name}': ${err}. Animation value ignored.`,
							),
				);

				continue animationValueListsLoop;
			}
		}

		if (typeof Syntax.validateAnimation === "function") {
			const isAnimationValid = Syntax.validateAnimation(keyframes, animatableStyle);

			if (!isAnimationValid) {
				// Attribute is invalid. Skip entire style.
				continue animationValueListsLoop;
			}
		}

		const existingStyles = stylesMap.get(name) || [];
		existingStyles.push(...keyframes.filter((kf): kf is DerivedValue[] => !!kf));
		stylesMap.set(name, existingStyles);
	}

	return stylesMap;
}

function isStyleAnimationCompatible(
	animatableStyle: "discrete" | "continuous",
	styleName: `tts:${string}`,
	reportError: (error: Error) => void,
): boolean {
	const definition = resolveStyleDefinitionByName(styleName);

	if (!definition) {
		reportError(
			new Error(
				`Style '${styleName}' was specified as animation-value, but no definition was found for it. Ignored.`,
			),
		);
		return false;
	}

	const isAnimatableDiscretely = isPropertyDiscretelyAnimatable(definition);
	const isAnimatableContinuously = isPropertyContinuouslyAnimatable(definition);

	const isAnimatable = isAnimatableDiscretely || isAnimatableContinuously;

	if (!isAnimatable) {
		/**
		 * "Targeting a non-animatable style is considered an error and
		 * must be ignored for the purpose of presentation processing."
		 */

		reportError(
			new Error(
				`Style '${styleName}' was specified as animation-value, but is not animatable. Ignored.`,
			),
		);

		return false;
	}

	if (animatableStyle === "discrete" && !isAnimatableDiscretely) {
		reportError(
			new Error(
				`Style '${styleName}' was specified as animation-value with a continuous animatable style, but is not discretely animatable. Ignored.`,
			),
		);

		return false;
	}

	return true;
}

function convertAnimationStylesToCSS(
	stylesFrames: Map<string, DerivedValue[][]>,
	scope: Scope,
	ownerElement: string,
	appliedElementName: string,
): Record<string, string[]> {
	const result: Record<string, string[]> = {};

	for (const [ttmlProperty, keyframes] of stylesFrames) {
		const definition = resolveStyleDefinitionByName(ttmlProperty);

		if (!definition || !styleAppliesToElement(definition, scope, appliedElementName)) {
			continue;
		}

		/*
		 * When a region animation is forwarded to content elements via the TAC parent
		 * chain, only inheritable properties can cross the inheritability boundary (§10.4.2.2).
		 * This does NOT apply to content-tree crossings (e.g. span child of a paragraph).
		 */
		if (
			ownerElement === "region" &&
			appliedElementName !== "region" &&
			!isInheritableStyle(definition)
		) {
			continue;
		}

		for (const derivedValues of keyframes) {
			const mapped = definition.toCSS(scope, derivedValues, appliedElementName);

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

	for (const attributeName in attributes) {
		const attributeValue = attributes[attributeName];

		if (!isStyleAttribute(attributeName) || !attributeValue) {
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
