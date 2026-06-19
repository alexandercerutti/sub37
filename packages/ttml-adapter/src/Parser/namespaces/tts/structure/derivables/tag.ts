import type { Derivable, DerivationResult, DerivedValue } from "../../../../structure/grammar.js";
import { isRejected } from "../../../../structure/grammar.js";

/**
 * Wraps the single result value in an object { type: tagName, value: originalValue }
 * and changes the type value to the given tagName for debug purposes.
 *
 * Only accepts derivables that produce a single DerivedValue per token
 * (primitives and oneOf selections). sequence and someOf are excluded
 * because they accumulate multiple values.
 *
 * @param tagName
 * @param node
 * @returns
 */
export function as<const N extends string, D>(
	tagName: N,
	node: Derivable<string, D extends DerivedValue<string, unknown> ? D : never>,
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
						values: [{ type: tagName, value: result.values[0] }],
					};
				}

				return result;
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
