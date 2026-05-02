/**
 * This context describes a series of items
 * that are valid for the subsequent items in
 * the same scope.
 */

import type { Context, ContextFactory, Scope } from "./Scope.js";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import { isInheritableStyle, resolveStyleDefinitionByName } from "../parseStyle.js";
import type { SupportedCSSProperties } from "../parseStyle.js";
import type { IDREF } from "../Token.js";
import { readScopeRegionContext } from "./RegionContainerContext.js";
import type { TTMLRegion } from "./RegionContainerContext.js";
import { readScopeAnimationContext } from "./AnimationContainerContext.js";
import type { Animation } from "./AnimationContainerContext.js";
import { readScopeStyleContainerContext } from "./StyleContainerContext.js";
import type { TTMLStyle } from "./StyleContainerContext.js";

const temporalActiveContextSymbol = Symbol("temporal.active.context");

export type ComputedCssProperties = {
	[K in keyof SupportedCSSProperties]: NonNullable<SupportedCSSProperties[K]>;
};

interface TemporalActiveContext extends Context<TemporalActiveContext, TemporalActiveInitParams> {
	computeStylesForElement(element: string): ComputedCssProperties;
	get region(): TTMLRegion | undefined;
	get animations(): Animation[];
}

declare module "./Scope" {
	interface ContextDictionary {
		[temporalActiveContextSymbol]: TemporalActiveContext;
	}
}

interface TemporalActiveInitParams {
	regionIDRef?: IDREF;
	stylesIDRefs?: IDREF[];
	animationsIDRefs?: IDREF[];
}

interface TemporalActiveContextState {
	region: TTMLRegion | undefined;
	styles: TTMLStyle[];
	animations: Animation[];
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
			get inline() {
				return store.styles.filter(({ kind }) => kind === "inline");
			},
			get nested() {
				return store.styles.filter(({ kind }) => kind === "nested");
			},
			get referential() {
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
				const { regionIDRef, stylesIDRefs = [], animationsIDRefs } = this.args;

				if (regionIDRef) {
					const stylesFromRegion = extractActiveStylesFromRegion(scope, regionIDRef);
					store.styles = store.styles.concat(stylesFromRegion);

					const regionContext = readScopeRegionContext(scope);
					store.region = regionContext?.getRegionById(regionIDRef);
				}

				if (stylesIDRefs?.length) {
					const styles = extractActiveStylesFromStyleStore(scope, stylesIDRefs);
					store.styles = store.styles.concat(styles);
				}

				if (animationsIDRefs?.length) {
					const animations = extractActiveAnimationsByIdRefs(scope, animationsIDRefs);
					store.animations = store.animations.concat(animations);
				}
			},
			[onMergeSymbol](incomingContext: TemporalActiveContext): void {
				const {
					regionIDRef: incomingRegionIDRef,
					stylesIDRefs: incomingStylesIDRefs = [],
					animationsIDRefs: incomingAnimationsIDRefs = [],
				} = incomingContext.args;

				if (incomingRegionIDRef && !store.region) {
					const regionContext = readScopeRegionContext(scope);
					store.region = regionContext?.getRegionById(incomingRegionIDRef);

					const stylesFromRegion = extractActiveStylesFromRegion(scope, incomingRegionIDRef);
					store.styles = store.styles.concat(stylesFromRegion);
				}

				if (incomingStylesIDRefs.length) {
					const styles = extractActiveStylesFromStyleStore(scope, incomingStylesIDRefs);
					const currentStylesIds = new Set(store.styles.map(({ "xml:id": id }) => id));

					for (const style of styles) {
						if (currentStylesIds.has(style["xml:id"])) {
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
				return store.region ?? this.parent?.region;
			},
			get animations(): Animation[] {
				return (this.parent?.animations ?? []).concat(store.animations);
			},
		};
	};
}

export function readScopeTemporalActiveContext(scope: Scope): TemporalActiveContext | undefined {
	return scope.getContextByIdentifier(temporalActiveContextSymbol);
}

function extractActiveStylesFromRegion(scope: Scope, idref: string): TTMLStyle[] {
	const regionContext = readScopeRegionContext(scope);

	if (!regionContext) {
		return [];
	}

	const regionStyles = regionContext.getStylesByRegionId(idref);

	if (!regionStyles.length) {
		return [];
	}

	const styles: TTMLStyle[] = [];
	const inlineStyles = regionStyles.find(({ kind }) => kind === "inline");

	if (inlineStyles) {
		styles.push(
			Object.create(inlineStyles, {
				kind: {
					value: "inline",
					enumerable: true,
				},
				styleAttributes: {
					value: filterStylesByInheritability(inlineStyles.styleAttributes),
					enumerable: true,
				},
			}),
		);
	}

	const nestedStyles = regionStyles.find(({ kind }) => kind === "nested");

	if (nestedStyles) {
		styles.push(
			Object.create(nestedStyles, {
				kind: {
					value: "nested",
					enumerable: true,
				},
				styleAttributes: {
					value: filterStylesByInheritability(nestedStyles.styleAttributes),
					enumerable: true,
				},
			}),
		);
	}

	return styles;
}

function filterStylesByInheritability(styles: Record<string, string>): Record<string, string> {
	const filteredStyles: Record<string, string> = {};

	for (const styleName of Object.keys(styles)) {
		if (!isInheritableStyle(resolveStyleDefinitionByName(styleName))) {
			continue;
		}

		filteredStyles[styleName] = styles[styleName]!;
	}

	return filteredStyles;
}

function extractActiveStylesFromStyleStore(scope: Scope, idrefs: string[]): TTMLStyle[] {
	if (!idrefs?.length) {
		return [];
	}

	const styles: TTMLStyle[] = [];
	const allowedKinds = ["inline", "nested", "referential"] as const;
	const styleContext = readScopeStyleContainerContext(scope);

	for (const style of idrefs) {
		const recognizedStyle = styleContext?.getStyleByIDRef(style);

		if (!recognizedStyle) {
			console.warn(
				`Style with id '${style}' referenced in temporal active context was not found in the document. Ignored.`,
			);

			continue;
		}

		if (!allowedKinds.includes(recognizedStyle.kind)) {
			console.log(
				`Style with not recognized kind ('${recognizedStyle.kind}') received. Additional style ignored.`,
			);

			continue;
		}

		styles.push(recognizedStyle);
	}

	return styles;
}

function extractActiveAnimationsByIdRefs(scope: Scope, idrefs: string[]): Animation[] {
	const animations: Animation[] = [];
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
