/**
 * This context describes a series of items
 * that are valid for the subsequent items in
 * the same scope.
 */

import type { Context, ContextFactory, Scope } from "./Scope.js";
import { readScopeStyleContainerContext } from "./StyleContainerContext.js";
import { TTMLStyle } from "../parseStyle.js";

const temporalActiveContextSymbol = Symbol("temporal.active.context");

interface TemporalActiveContext extends Context<TemporalActiveContext> {
	computedStyles: Record<string, string>;
}

interface TemporalActiveInitParams {
	stylesIDRefs?: string[];
}

export function createTemporalActiveContext(
	initParams: TemporalActiveInitParams,
): ContextFactory<TemporalActiveContext> {
	const store = Object.assign(
		{
			stylesIDRefs: [],
		},
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

				const styleContext = readScopeStyleContainerContext(scope);

				if (!styleContext?.styles) {
					return {};
				}

				const finalStylesAttributes: TTMLStyle["attributes"] = {};

				for (const idref of idrefs) {
					const style = styleContext.styles.get(idref);

					if (!style) {
						continue;
					}

					Object.assign(finalStylesAttributes, style.attributes);
				}

				computedStyleCache = finalStylesAttributes;
				return finalStylesAttributes;
			},
			// get regions(): Map<string, TTMLRegion> {
			// 	return regionsArchive;
			// },
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
