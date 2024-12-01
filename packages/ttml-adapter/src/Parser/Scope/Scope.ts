// Made to be extended by the contexts
export interface ContextDictionary {
	[K: symbol]: Context<object>;
}

export interface Scope {
	parent: Scope | undefined;
	getAllContexts(): Context[];
	getContextByIdentifier<const ID extends keyof ContextDictionary>(
		identifier: ID,
	): ContextDictionary[ID] | undefined;
	addContext(context: ContextFactory): void;
}

export type ContextFactory<ContextObject extends Context = Context> = (
	scope: Scope,
) => ContextObject | null;

export interface Context<ParentType extends object = object, ArgsType = unknown> {
	readonly identifier: symbol;
	parent?: ParentType | undefined;
	get args(): ArgsType;
	[onMergeSymbol]?(context: Context): void;
	[onAttachedSymbol]?(): void;
}

export const onAttachedSymbol = Symbol("context.on.attached");
export const onMergeSymbol = Symbol("context.on.merge");

/**
 * A scope is associated to an element inside the
 * tree (a "span", "p", "div", "body" (global)).
 *
 * Therefore reading should be seen as you are reading
 * it by being one of its children.
 *
 * @param parent
 * @param contexts
 * @returns
 */

export function createScope(parent: Scope | undefined, ...contexts: ContextFactory[]): Scope {
	const contextsMap = new Map<symbol, Context>();

	function buildContexts(scope: Scope): Scope {
		if (parent) {
			const parentContexts = parent.getAllContexts();

			for (const context of parentContexts) {
				contextsMap.set(context.identifier, context);
			}
		}

		for (const contextMaker of contexts) {
			if (!contextMaker) {
				continue;
			}

			const context = contextMaker(scope);

			if (!context) {
				continue;
			}

			if (!contextsMap.has(context.identifier)) {
				contextsMap.set(context.identifier, context);

				if (typeof context[onAttachedSymbol] === "function") {
					context[onAttachedSymbol]();
				}

				continue;
			}

			const parentContext = parent?.getContextByIdentifier(context.identifier);

			if (parentContext) {
				context.parent = parentContext;
				contextsMap.set(context.identifier, context);
				continue;
			}

			const targetContext = contextsMap.get(context.identifier);

			if (typeof targetContext[onMergeSymbol] === "function") {
				targetContext[onMergeSymbol](context);
			}
		}

		return scope;
	}

	return buildContexts({
		get parent() {
			return parent;
		},
		getAllContexts(): Context[] {
			return Array.from(contextsMap, ([, context]) => context);
		},
		getContextByIdentifier<const ID extends keyof ContextDictionary>(
			identifier: ID,
		): ContextDictionary[ID] | undefined {
			return contextsMap.get(identifier) || undefined;
		},
		addContext(contextFactory: ContextFactory): void {
			if (!contextFactory) {
				return;
			}

			const context = contextFactory(this);

			if (!context) {
				return;
			}

			if (contextsMap.has(context.identifier)) {
				contextsMap.get(context.identifier)[onMergeSymbol]?.(context);
				return;
			}

			contextsMap.set(context.identifier, context);

			if (!parent) {
				if (typeof context[onAttachedSymbol] === "function") {
					context[onAttachedSymbol]();
				}

				return;
			}

			const parentContext = parent.getContextByIdentifier(context.identifier);

			if (!parentContext) {
				return;
			}

			context.parent = parentContext;

			if (typeof context[onAttachedSymbol] === "function") {
				context[onAttachedSymbol]();
			}
		},
	});
}
