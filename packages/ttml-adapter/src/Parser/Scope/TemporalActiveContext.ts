/**
 * This context describes a series of items
 * that are valid for the subsequent items in
 * the same scope.
 */

import type { TTMLRegion } from "../parseRegion.js";
import type { Context, ContextFactory, Scope } from "./Scope.js";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import type { SupportedCSSProperties, TTMLStyle } from "../parseStyle.js";
import { readScopeRegionContext } from "./RegionContainerContext.js";
import type { Animation, CalcMode } from "../Animations/parseAnimation.js";
import { readScopeAnimationContext } from "./AnimationContainerContext.js";

const temporalActiveContextSymbol = Symbol("temporal.active.context");

type ComputedCssProperties = {
	[K in keyof SupportedCSSProperties]: NonNullable<SupportedCSSProperties[K]>;
};

interface TemporalActiveContext extends Context<TemporalActiveContext, TemporalActiveInitParams> {
	computeStylesForElement(element: string): ComputedCssProperties;
	get region(): TTMLRegion | undefined;
	get animations(): Animation<CalcMode>[];
}

declare module "./Scope" {
	interface ContextDictionary {
		[temporalActiveContextSymbol]: TemporalActiveContext;
	}
}

export type ActiveStyle = TTMLStyle & {
	kind: "inline" | "referential" | "nested";
};

interface TemporalActiveInitParams {
	regionIDRef?: string;
	styles?: ActiveStyle[];
	animationsIDRefs?: string[];
}

interface TemporalActiveContextState {
	region: TTMLRegion | undefined;
	styles: ActiveStyle[];
	animations: Animation<CalcMode>[];
}

export function createTemporalActiveContext(
	initParams: TemporalActiveInitParams,
): ContextFactory<TemporalActiveContext> {
	return function (scope: Scope) {
		const store: TemporalActiveContextState = {
			styles: [],
			region: undefined,
			animations: [],
		};

		const stylesFilter = {
			get inline(): ActiveStyle[] {
				return store.styles.filter(({ kind }) => kind === "inline");
			},
			get nested(): ActiveStyle[] {
				return store.styles.filter(({ kind }) => kind === "nested");
			},
			get referential(): ActiveStyle[] {
				return store.styles.filter(({ kind }) => kind === "referential");
			},
		};

		return {
			parent: undefined,
			identifier: temporalActiveContextSymbol,
			get args() {
				return initParams;
			},
			[onAttachedSymbol](): void {
				const { regionIDRef, styles = [], animationsIDRefs } = this.args;

				if (regionIDRef) {
					const stylesFromRegion = extractActiveStylesFromRegion(scope, regionIDRef);
					store.styles = store.styles.concat(stylesFromRegion);

					const regionContext = readScopeRegionContext(scope);
					store.region = regionContext?.getRegionById(regionIDRef);
				}

				if (styles.length) {
					const recognizedStyles = extractActiveStylesFromStyleStore(styles);
					store.styles = store.styles.concat(recognizedStyles);
				}

				if (animationsIDRefs?.length) {
					const animations = extractActiveAnimationsByIdRefs(scope, animationsIDRefs);
					store.animations = store.animations.concat(animations);
				}
			},
			[onMergeSymbol](incomingContext: TemporalActiveContext): void {
				const {
					regionIDRef: incomingRegionIDRef,
					styles: incomingStyles = [],
					animationsIDRefs: incomingAnimationsIDRefs = [],
				} = incomingContext.args;

				if (incomingRegionIDRef && !store.region) {
					const regionContext = readScopeRegionContext(scope);
					store.region = regionContext?.getRegionById(incomingRegionIDRef);

					const stylesFromRegion = extractActiveStylesFromRegion(scope, incomingRegionIDRef);
					store.styles = store.styles.concat(stylesFromRegion);
				}

				if (incomingStyles.length) {
					const currentStylesIds = new Set(store.styles.map(({ id }) => id));
					const recognizedStyles = extractActiveStylesFromStyleStore(incomingStyles);

					for (const style of recognizedStyles) {
						if (currentStylesIds.has(style.id)) {
							continue;
						}

						store.styles.push(style);
					}
				}

				if (incomingAnimationsIDRefs?.length) {
					const animations = extractActiveAnimationsByIdRefs(scope, incomingAnimationsIDRefs);
					const currentAnimationsIds = new Set(store.animations.map(({ id }) => id));

					for (const animation of animations) {
						if (currentAnimationsIds.has(animation.id)) {
							continue;
						}

						store.animations.push(animation);
					}
				}
			},
			computeStylesForElement(element: string): ComputedCssProperties {
				/**
				 * @see https://w3c.github.io/ttml2/#semantics-style-association
				 */

				const parentComputedStyles = this.parent?.computeStylesForElement(element) || {};

				const {
					referential: referentialStyles,
					nested: nestedStyles,
					inline: inlineStyles,
				} = stylesFilter;

				/**
				 * Processing in the order defined by the standard
				 * @see https://w3c.github.io/ttml2/#semantics-style-resolution-processing-sss
				 */

				const computedStyles = referentialStyles
					.concat(nestedStyles)
					.concat(inlineStyles)
					.reduce<ReturnType<TTMLStyle["apply"]>>((acc, style) => {
						return Object.assign(acc, style.apply(element));
					}, {});

				return Object.assign({}, parentComputedStyles, computedStyles);
			},
			get region(): TTMLRegion | undefined {
				return store.region;
			},
			get animations(): Animation<CalcMode>[] {
				return store.animations;
			},
		};
	};
}

export function readScopeTemporalActiveContext(scope: Scope): TemporalActiveContext | undefined {
	return scope.getContextByIdentifier(temporalActiveContextSymbol);
}

function extractActiveStylesFromRegion(scope: Scope, idref: string): ActiveStyle[] {
	const regionContext = readScopeRegionContext(scope);

	if (!regionContext) {
		return [];
	}

	const regionStyles = regionContext.getStylesByRegionId(idref);

	if (!regionStyles.length) {
		return [];
	}

	const styles: ActiveStyle[] = [];
	const inlineStyles = regionStyles.find(({ id }) => id === "inline");

	if (inlineStyles) {
		styles.push(
			Object.create(inlineStyles, {
				kind: {
					value: "inline",
				},
			}),
		);
	}

	const nestedStyles = regionStyles.find(({ id }) => id === "nested");

	if (nestedStyles) {
		styles.push(
			Object.create(nestedStyles, {
				kind: {
					value: "nested",
				},
			}),
		);
	}

	return styles;
}

function extractActiveStylesFromStyleStore(storeStyles: ActiveStyle[]): ActiveStyle[] {
	if (!storeStyles?.length) {
		return [];
	}

	const styles: ActiveStyle[] = [];
	const allowedKinds = ["inline", "nested", "referential"] as const;

	for (const style of storeStyles) {
		if (!allowedKinds.includes(style.kind)) {
			console.log(
				`Style with not recognized kind ('${style.kind}') received. Additional style ignored.`,
			);

			continue;
		}

		styles.push(style);
	}

	return styles;
}

function extractActiveAnimationsByIdRefs(scope: Scope, idrefs: string[]): Animation<CalcMode>[] {
	const animations: Animation<CalcMode>[] = [];
	const animationContext = readScopeAnimationContext(scope);

	for (const idref of idrefs) {
		const recognizedAnimation = animationContext?.getAnimationById(idref);

		if (!recognizedAnimation) {
			console.warn(
				`Animation with id '${idref}' referenced in temporal active context was not found in the document. Ignored.`,
			);

			continue;
		}

		animations.push(recognizedAnimation);
	}

	return animations;
}
