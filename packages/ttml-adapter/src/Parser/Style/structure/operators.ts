export const DerivationState = {
	DERIVED: /****/ 0b0000001,
	REJECTED: /***/ 0b0000010,
	DONE: /*******/ 0b0000100,
	OPTIONAL: /***/ 0b0001000,
} as const;

export type DerivationState = typeof DerivationState;

export type DerivationResult<RR = unknown> =
	| {
			state: number;
			values?: unknown[];
	  }
	| {
			state: DerivationState["DERIVED"];
			nextNode: Derivable<string, RR>;
			values: unknown[];
	  }
	| {
			state: DerivationState["DONE"];
			values: unknown[];
	  }
	| {
			state: DerivationState["REJECTED"];
	  };

export type InferDerivableValue<D extends Derivable> =
	D extends Derivable<any, infer R> ? R : never;

export function isDerived(
	derivationResult: DerivationResult,
): derivationResult is Extract<DerivationResult, { state: DerivationState["DERIVED"] }> {
	return Boolean(derivationResult.state & DerivationState.DERIVED);
}

export function isRejected(
	derivationResult: DerivationResult,
): derivationResult is Extract<DerivationResult, { state: DerivationState["REJECTED"] }> {
	return Boolean(derivationResult.state & DerivationState.REJECTED);
}

export function isDone(
	derivationResult: DerivationResult,
): derivationResult is Extract<DerivationResult, { state: DerivationState["DONE"] }> {
	return Boolean(derivationResult.state & DerivationState.DONE);
}

export interface Derivable<_SymbolName extends string = string, RR = unknown> {
	readonly type: string;
	derive(token: string): DerivationResult<RR>;
}

export function zeroOrOne<RR>(node: Derivable<string, RR>): Derivable<"?", RR | undefined> {
	return Object.create(null, {
		type: {
			value: "?",
		},
		derive: {
			value(token: string): DerivationResult {
				const derivationResult = node.derive(token);

				if (derivationResult.state & DerivationState.REJECTED) {
					return {
						state: DerivationState.REJECTED | DerivationState.OPTIONAL,
					};
				}

				return derivationResult;
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}

export function zeroOrMore<RR>(node: Derivable<string, RR>): Derivable<"*", RR[] | undefined> {
	return Object.create(null, {
		type: {
			value: "*",
		},
		derive: {
			value(token: string): DerivationResult<RR> {
				const derivationResult = node.derive(token);

				if (isRejected(derivationResult)) {
					return {
						state: DerivationState.REJECTED | DerivationState.OPTIONAL,
					};
				}

				if (isDerived(derivationResult)) {
					return {
						state: DerivationState.DERIVED,
						nextNode: sequence([derivationResult.nextNode, zeroOrMore(node)]),
						values: derivationResult.values,
					};
				}

				return {
					state: DerivationState.DERIVED,
					nextNode: zeroOrMore(node),
					values: derivationResult.values,
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}

export function oneOrMore<RR>(node: Derivable<string, RR>): Derivable<"+", RR> {
	return Object.create(null, {
		type: {
			value: "+",
		},
		derive: {
			value(token: string): DerivationResult<RR> {
				const derivationResult = node.derive(token);

				if (isRejected(derivationResult)) {
					return {
						state: DerivationState.REJECTED,
					};
				}

				if (isDerived(derivationResult)) {
					return {
						state: DerivationState.DERIVED,
						nextNode: sequence([derivationResult.nextNode, zeroOrMore(node)]),
						values: derivationResult.values,
					};
				}

				return {
					state: DerivationState.DERIVED,
					nextNode: zeroOrMore(node),
					values: derivationResult.values,
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}

type MapDerivableValues<T extends Derivable[]> = {
	[K in keyof T]: InferDerivableValue<T[K]>;
};

export function sequence<const D extends Derivable<string, unknown>[]>(
	nodes: D,
): Derivable<"&&", MapDerivableValues<D>> {
	return Object.create(null, {
		type: {
			value: "&&",
		},
		derive: {
			value(token: string): DerivationResult {
				let targetNodes: Derivable<string, unknown>[] = nodes;

				while (true) {
					if (!targetNodes.length) {
						return {
							state: DerivationState.REJECTED,
						};
					}

					const [head, ...tail] = targetNodes;
					const derivationResult = head.derive(token);

					if (isDone(derivationResult)) {
						if (!tail.length) {
							return {
								state: DerivationState.DONE,
								values: derivationResult.values,
							};
						}

						return {
							state: DerivationState.DERIVED,
							nextNode: sequence(tail),
							values: derivationResult.values,
						};
					}

					if (isDerived(derivationResult)) {
						return {
							state: DerivationState.DERIVED,
							nextNode: sequence([derivationResult.nextNode].concat(tail)),
							values: derivationResult.values,
						};
					}

					if (derivationResult.state & DerivationState.OPTIONAL) {
						targetNodes = tail;
						continue;
					}

					return derivationResult;
				}
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}

export function oneOf<const D extends Derivable[]>(
	nodes: D,
): Derivable<"|", InferDerivableValue<D[number]>> {
	return Object.create(null, {
		type: {
			value: "|",
		},
		derive: {
			value(token: string): DerivationResult {
				let successResults: Exclude<DerivationResult, { state: DerivationState["REJECTED"] }>[] =
					[];

				for (const node of nodes) {
					const derivationResult = node.derive(token);

					// Optional rejection nodes still count as rejected here
					if (isRejected(derivationResult)) {
						continue;
					}

					successResults.push(derivationResult);
				}

				if (!successResults.length) {
					return {
						state: DerivationState.REJECTED,
					};
				}

				if (successResults.length === 1) {
					return successResults[0];
				}

				const derivedResults = successResults.filter(isDerived);
				const doneResults = successResults.filter(isDone);

				/**
				 * No derived paths means all paths are 'done'.
				 * We cannot derive further.
				 */
				if (!derivedResults.length) {
					if (doneResults.length) {
						/**
						 * Equivalent results: picking the first one is perfectly fine
						 */

						return doneResults[0];
					}

					return {
						state: DerivationState.DONE,
						values: [],
					};
				}

				// Collect values from all successful paths (ambiguity preservation)
				const collectedValues = successResults.flatMap((r) => r.values);

				/**
				 * At least one pattern has completed derivation and
				 * cannot proceed further. However, other patterns might.
				 * So, we need to return them.
				 */
				if (doneResults.length) {
					return {
						state: DerivationState.DERIVED,
						nextNode: zeroOrOne(oneOf(derivedResults.map((result) => result.nextNode))),
						values: collectedValues,
					};
				}

				/**
				 * None of the successful patterns are done,
				 * we still need to find at least one done.
				 */

				return {
					state: DerivationState.DERIVED,
					nextNode: oneOf(derivedResults.map((result) => result.nextNode)),
					values: collectedValues,
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}

export function someOf<const D extends Derivable<string, unknown>[]>(
	nodes: D,
): Derivable<"||", D[number] extends Derivable<string, infer R> ? R : never> {
	return Object.create(null, {
		type: {
			value: "||",
		},
		derive: {
			value(token: string): DerivationResult {
				const unmatchedNodes: Derivable[] = [];

				for (let i = 0; i < nodes.length; i++) {
					const currentNode = nodes[i];
					const derivationResult = currentNode.derive(token);

					if (isRejected(derivationResult)) {
						unmatchedNodes.push(currentNode);
						continue;
					}

					const nextTargetNodes = unmatchedNodes.concat(nodes.slice(i + 1));

					if (isDerived(derivationResult)) {
						return {
							state: DerivationState.DERIVED,
							nextNode: sequence([derivationResult.nextNode, zeroOrOne(someOf(nextTargetNodes))]),
							values: derivationResult.values,
						};
					}

					if (isDone(derivationResult)) {
						if (!nextTargetNodes.length) {
							return {
								state: DerivationState.DONE,
								values: derivationResult.values,
							};
						}

						return {
							state: DerivationState.DERIVED,
							nextNode: zeroOrOne(someOf(nextTargetNodes)),
							values: derivationResult.values,
						};
					}
				}

				return {
					state: DerivationState.REJECTED,
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
