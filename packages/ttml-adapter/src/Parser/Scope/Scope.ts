export interface Scope {
	parent: Scope | undefined;
	getAllContexts(): Context[];
	getContextByIdentifier(identifier: symbol): Context | undefined;
	addContext(context: ContextFactory): void;
}

export type ContextFactory<ContextObject extends Context = Context> = (
	scope: Scope,
) => ContextObject | null;

export interface Context<ParentType extends object = object> {
	readonly identifier: symbol;
	parent?: ParentType | undefined;
	mergeWith(context: Context): void;
}

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
				continue;
			}

			contextsMap.get(context.identifier).mergeWith(context);
		}

		if (parent) {
			const parentContexts = parent.getAllContexts();

			for (const context of parentContexts) {
				if (!contextsMap.has(context.identifier)) {
					contextsMap.set(context.identifier, context);
					continue;
				}

				contextsMap.get(context.identifier).parent = context;
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
		getContextByIdentifier(identifier: symbol): Context {
			return contextsMap.get(identifier) || undefined;
		},
		addContext(contextFactory: ContextFactory): void {
			if (!contextFactory) {
				return;
			}

			const context = contextFactory(this);

			if (contextsMap.has(context.identifier)) {
				contextsMap.get(context.identifier).mergeWith(context);
				return;
			}

			contextsMap.set(context.identifier, context);

			if (!parent) {
				return;
			}

			const parentContext = parent.getContextByIdentifier(context.identifier);

			if (!parentContext) {
				return;
			}

			context.parent = parentContext;
		},
	});
}
