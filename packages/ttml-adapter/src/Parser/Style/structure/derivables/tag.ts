import type { Derivable, DerivationResult } from "../operators.js";
import { isRejected } from "../operators.js";

/**
 * Wraps the result values in an object { type: tagName, value: originalValue }
 * and changes the type value to the given tagName for debug purposes.
 *
 * @param tagName
 * @param node
 * @returns
 */
export function as<const N extends string, D>(
	tagName: N,
	node: Derivable<string, D>,
): Derivable<N, { type: N; value: D }> {
	return Object.create(null, {
		type: {
			value: tagName,
		},
		derive: {
			enumerable: true,
			value(token: string): DerivationResult {
				const result = node.derive(token);

				if (isRejected(result)) {
					return result;
				}

				if (result.values) {
					return {
						...result,
						values: result.values?.map((v) => ({ type: tagName, value: v })),
					};
				}

				return result;
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
