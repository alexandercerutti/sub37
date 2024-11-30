/**
 * This context describes a series of items
 * that are valid for the subsequent items in
 * the same scope.
 */

import type { TTMLRegion } from "../parseRegion.js";
import type { Context, ContextFactory, Scope } from "./Scope.js";
import { onMergeSymbol } from "./Scope.js";
import { readScopeStyleContainerContext } from "./StyleContainerContext.js";
import { TTMLStyle } from "../parseStyle.js";
import { readScopeRegionContext } from "./RegionContainerContext.js";

const temporalActiveContextSymbol = Symbol("temporal.active.context");

interface TemporalActiveContext extends Context<TemporalActiveContext> {
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
				if (computedStyleCache) {
					return computedStyleCache;
				}

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

				computedStyleCache = finalStylesAttributes;
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
