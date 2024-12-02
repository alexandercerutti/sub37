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
	computedStyles: Record<string, string>;
	get region(): TTMLRegion;
	get regionIdRef(): string;
	get stylesIDRefs(): string[];
}

declare module "./Scope" {
	interface ContextDictionary {
		[temporalActiveContextSymbol]: TemporalActiveContext;
	}
}

interface TemporalActiveInitParams {
	regionIDRef?: string;
	stylesIDRefs?: string[];
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
				return initParams;
			},
			[onAttachedSymbol](): void {
				const styleContext = readScopeStyleContainerContext(scope);

				if (styleContext) {
					for (const idref of this.args.stylesIDRefs) {
						const style = styleContext.getStyleByIDRef(idref);

						if (!style) {
							continue;
						}

						stylesContainer.referential.push(style);
					}
				}

				const regionContext = readScopeRegionContext(scope);
				const regionIdref = this.args.regionIDRef;

				if (regionContext && regionIdref) {
					const regionStyles = regionContext.getStylesByRegionId(regionIdref);

					if (regionStyles.length) {
						const inlineStyles = regionStyles.find(({ id }) => id === "inline");

						if (inlineStyles) {
							stylesContainer.inline.concat(inlineStyles);
						}

						const nestedStyles = regionStyles.find(({ id }) => id === "nested");

						if (nestedStyles) {
							stylesContainer.nested.concat(regionStyles);
						}
					}
				}
			},
			[onMergeSymbol](context: TemporalActiveContext): void {
				if (context.regionIdRef && !store.regionIDRef) {
					store.regionIDRef = context.regionIdRef;
				}

				if (context.stylesIDRefs.length) {
					store.stylesIDRefs = Array.from(
						new Set([...store.stylesIDRefs, ...context.stylesIDRefs]),
					);
				}
			},
			get computedStyles(): TTMLStyle["attributes"] {
				const idrefs = store.stylesIDRefs;

				const styleContext = readScopeStyleContainerContext(scope);
				const regionContext = readScopeRegionContext(scope);

				if (!idrefs.length) {
					const styles: Record<string, string> = {};

					if (regionContext && store.regionIDRef) {
						Object.assign(styles, regionContext.getStylesByRegionId(store.regionIDRef));
					}

					return Object.assign(styles, this.parent?.computedStyles);
				}

				const finalStylesAttributes: TTMLStyle["attributes"] = {};

				if (store.regionIDRef) {
					const region = regionContext.getRegionById(store.regionIDRef);

					if (region?.styles) {
						Object.assign(finalStylesAttributes, region.styles);
					}
				}

				for (const styleIdref of idrefs) {
					const style = styleContext.getStyleByIDRef(styleIdref);

					if (!style) {
						continue;
					}

					Object.assign(finalStylesAttributes, style.attributes);
				}

				return finalStylesAttributes;
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
