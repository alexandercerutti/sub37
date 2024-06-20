/**
 * This context describes a series of items
 * that are valid for the subsequent items in
 * the same scope.
 */

import type { Context, ContextFactory, Scope } from "./Scope.js";

const temporalActiveContextSymbol = Symbol("temporal.active.context");

interface TemporalActiveContext extends Context<TemporalActiveContext> {}

export function createStyleContext(): ContextFactory<TemporalActiveContext> | null {
	return function (scope: Scope) {
		return {
			parent: undefined,
			identifier: temporalActiveContextSymbol,
			mergeWith(context: TemporalActiveContext): void {},
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
