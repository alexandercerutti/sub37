/**
 * This context describes a series of items
 * that are valid for the subsequent items in
 * the same scope.
 */

import type { TTMLRegion } from "../parseRegion.js";
import type { Context, ContextFactory, Scope } from "./Scope.js";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import { readScopeStyleContainerContext } from "./StyleContainerContext.js";
import { TTMLStyle } from "../parseStyle.js";
import { readScopeRegionContext } from "./RegionContainerContext.js";

const temporalActiveContextSymbol = Symbol("temporal.active.context");

interface TemporalActiveContext extends Context<TemporalActiveContext, TemporalActiveInitParams> {
	computeStylesForElement(element: string): ReturnType<TTMLStyle["apply"]>;
	get region(): TTMLRegion;
	get regionIdRef(): string;
	get stylesIDRefs(): string[];
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
}

type StylesContainer = Record<"inline" | "nested" | "referential", TTMLStyle[]>;

export function createTemporalActiveContext(
	initParams: TemporalActiveInitParams,
): ContextFactory<TemporalActiveContext> {
	return function (scope: Scope) {
		const store = Object.assign(
			{
				styles: [],
				regionIDRef: undefined,
			} satisfies TemporalActiveInitParams,
			initParams,
		);

		const stylesContainer: StylesContainer = {
			inline: [],
			nested: [],
			referential: [],
		};

		return {
			parent: undefined,
			identifier: temporalActiveContextSymbol,
			get args() {
				return Object.assign(
					{
						stylesIDRefs: [],
						regionIdRef: undefined,
					},
					initParams,
				);
			},
			[onAttachedSymbol](): void {
				const { regionIDRef, styles } = this.args;

				const regionContext = readScopeRegionContext(scope);

				if (regionContext && regionIDRef) {
					const regionStyles = regionContext.getStylesByRegionId(regionIDRef);

					if (regionStyles.length) {
						const inlineStyles = regionStyles.find(({ id }) => id === "inline");

						if (inlineStyles) {
							stylesContainer.inline.push(inlineStyles);
						}

						const nestedStyles = regionStyles.find(({ id }) => id === "nested");

						if (nestedStyles) {
							stylesContainer.nested.push(nestedStyles);
						}
					}
				}

				if (styles.length) {
					for (const style of styles) {
						if (!(style.kind in stylesContainer)) {
							console.log(
								`Unknown style kind (received '${style.kind}'). Additional style ignored.`,
							);
							continue;
						}

						stylesContainer[style.kind].push(style);
					}
				}
			},
			[onMergeSymbol](context: TemporalActiveContext): void {
				const { regionIDRef, styles } = context.args;

				if (regionIDRef && !store.regionIDRef) {
					store.regionIDRef = regionIDRef;
					const regionContext = readScopeRegionContext(scope);

					if (regionContext) {
						const regionStyles = regionContext.getStylesByRegionId(regionIDRef);

						if (regionStyles.length) {
							const inlineStyles = regionStyles.find(({ id }) => id === "inline");

							if (inlineStyles) {
								stylesContainer.inline.push(inlineStyles);
							}

							const nestedStyles = regionStyles.find(({ id }) => id === "nested");

							if (nestedStyles) {
								stylesContainer.nested.push(nestedStyles);
							}
						}
					}
				}

				if (styles.length) {
					if (!store.styles.length) {
						store.styles.concat(styles);
						return;
					}

					const currentStylesIds = new Set(store.styles.map(({ id }) => id));
					const selectedStyles: ActiveStyle[] = [];

					for (const style of styles) {
						if (currentStylesIds.has(style.id)) {
							continue;
						}

						selectedStyles.push(style);
					}

					store.styles.concat(selectedStyles);
				}
			},
			computeStylesForElement(element: string): ReturnType<TTMLStyle["apply"]> {
				/**
				 * @see https://w3c.github.io/ttml2/#semantics-style-association
				 */

				const parentComputedStyles = this.parent?.computeStylesForElement(element) || {};

				const {
					referential: referentialStyles = [],
					nested: nestedStyles = [],
					inline: inlineStyles = [],
				} = stylesContainer;

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
			get regionIdRef(): string {
				return store.regionIDRef;
			},
			get stylesIDRefs(): string[] {
				return store.styles.map(({ id }) => id);
			},
			get region(): TTMLRegion | undefined {
				if (!store.regionIDRef) {
					return undefined;
				}

				const regionContext = readScopeRegionContext(scope);
				return regionContext.getRegionById(store.regionIDRef);
			},
		};
	};
}

export function readScopeTemporalActiveContext(scope: Scope): TemporalActiveContext | undefined {
	return scope.getContextByIdentifier(temporalActiveContextSymbol);
}
