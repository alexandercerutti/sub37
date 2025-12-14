import type { Derivable } from "../operators";

/**
 * Alias wrapper for nodes that are just renaming another node.
 * @param name
 * @param node
 * @returns
 */
export function alias<N extends string>(name: N, node: Derivable): Derivable<N> {
	return Object.create(node, {
		symbol: {
			value: Symbol(name),
		},
	});
}
