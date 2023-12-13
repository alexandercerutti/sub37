export interface Scope {
	getAllContexts(): Context[];
	getContextByIdentifier(identifier: symbol): Context | undefined;
}

export interface Context<ParentType extends ThisType<Context<unknown>> = unknown> {
	readonly identifier: symbol;
	parent?: ParentType | undefined;
}

export function createScope(parent: Scope | undefined, ...contexts: Context[]): Scope {
	const contextsMap = new Map<symbol, Context>(
		contexts.map((context) => [context.identifier, context]),
	);

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

	return {
		getAllContexts(): Context[] {
			return Array.from(contextsMap, ([, context]) => context);
		},
		getContextByIdentifier(identifier: symbol): Context {
			return contextsMap.get(identifier) || undefined;
		},
	};
}
