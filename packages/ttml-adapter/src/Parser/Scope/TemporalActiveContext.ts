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

export type AdditionalStyle = TTMLStyle & {
	kind: "inline" | "referential" | "nested";
};

interface TemporalActiveInitParams {
	regionIDRef?: string;
	stylesIDRefs?: string[];
	additionalStyles?: AdditionalStyle[];
}

type StylesContainer = Record<"inline" | "nested" | "referential", TTMLStyle[]>;

export function createTemporalActiveContext(
	initParams: TemporalActiveInitParams,
): ContextFactory<TemporalActiveContext> {
	return function (scope: Scope) {
		const store = Object.assign(
			{
				stylesIDRefs: [],
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
						additionalStyles: [],
						regionIdRef: undefined,
					},
					initParams,
				);
			},
			[onAttachedSymbol](): void {
				const { regionIDRef, stylesIDRefs, additionalStyles } = this.args;
				const styleContext = readScopeStyleContainerContext(scope);

				if (styleContext) {
					for (const idref of stylesIDRefs) {
						const style = styleContext.getStyleByIDRef(idref);

						if (!style) {
							continue;
						}

						stylesContainer.referential.push(style);
					}
				}

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

				if (additionalStyles.length) {
					for (const style of additionalStyles) {
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
					.reduce<TTMLStyle["attributes"]>(
						(acc, { attributes }) => Object.assign(acc, attributes),
						{},
					);

				return Object.assign({}, parentComputedStyles, computedStyles);
			},
			get regionIdRef(): string {
				return store.regionIDRef;
			},
			get stylesIDRefs(): string[] {
				return store.stylesIDRefs;
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
