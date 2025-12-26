import type { Derivable } from "../operators.js";

/**
 * Alias wrapper for nodes that are just renaming another node.
 *
 * @param name
 * @param node
 * @returns
 */
export function alias<N extends string, T>(name: N, node: Derivable<string, T>): Derivable<N, T> {
	return Object.create(node, {
		type: {
			value: name,
		},
	});
}
