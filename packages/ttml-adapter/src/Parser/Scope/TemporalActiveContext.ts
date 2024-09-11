/**
 * This context describes a series of items
 * that are valid for the subsequent items in
 * the same scope.
 */

import type { TTMLRegion } from "../parseRegion.js";
import type { Context, ContextFactory, Scope } from "./Scope.js";
import { readScopeStyleContainerContext } from "./StyleContainerContext.js";
import { TTMLStyle } from "../parseStyle.js";
import { readScopeRegionContext } from "./RegionContainerContext.js";

const temporalActiveContextSymbol = Symbol("temporal.active.context");

interface TemporalActiveContext extends Context<TemporalActiveContext> {
	computedStyles: Record<string, string>;
	region: TTMLRegion;
}

interface TemporalActiveInitParams {
	regionIDRef?: string;
	stylesIDRefs?: string[];
}

export function createTemporalActiveContext(
	initParams: TemporalActiveInitParams,
): ContextFactory<TemporalActiveContext> {
	const store = Object.assign(
		{
			stylesIDRefs: [],
			regionIDRef: undefined,
		} satisfies TemporalActiveInitParams,
		initParams,
	);

	let computedStyleCache: TTMLStyle["attributes"] | null = null;

	return function (scope: Scope) {
		return {
			parent: undefined,
			identifier: temporalActiveContextSymbol,
			mergeWith(context: TemporalActiveContext): void {
				/**
				 * @TODO add merging logic
				 */
			},
			get computedStyles(): TTMLStyle["attributes"] {
				if (computedStyleCache) {
					return computedStyleCache;
				}

				const idrefs = store.stylesIDRefs;

				if (!idrefs.length) {
					return this.parent?.computedStyles;
				}

				const finalStylesAttributes: TTMLStyle["attributes"] = {};

				const styleContext = readScopeStyleContainerContext(scope);
				const regionContext = readScopeRegionContext(scope);

				if (store.regionIDRef) {
					const region = regionContext.getRegionById(store.regionIDRef);

					if (region?.styles) {
						Object.assign(finalStylesAttributes, region.styles);
					}
				}

				for (const styleIdref of idrefs) {
					const style = styleContext.styles.get(styleIdref);

					if (!style) {
						continue;
					}

					Object.assign(finalStylesAttributes, style.attributes);
				}

				computedStyleCache = finalStylesAttributes;
				return finalStylesAttributes;
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
	let context: Context | undefined;

	if (!(context = scope.getContextByIdentifier(temporalActiveContextSymbol))) {
		return undefined;
	}

	return context as TemporalActiveContext;
}
