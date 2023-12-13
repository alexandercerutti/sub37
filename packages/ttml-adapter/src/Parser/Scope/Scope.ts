export interface Scope {
	getAllContexts(): Context[];
	getContextByIdentifier(identifier: symbol): Context | undefined;
	addContext(context: Context): void;
}

export interface Context<ParentType extends ThisType<Context<unknown>> = unknown> {
	readonly identifier: symbol;
	parent?: ParentType | undefined;
	mergeWith(context: Context): void;
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
		addContext(context: Context): void {
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
	};
}
