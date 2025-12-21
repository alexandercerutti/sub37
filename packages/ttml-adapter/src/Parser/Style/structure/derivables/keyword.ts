import type { Derivable, DerivationResult } from "../operators.js";
import { DerivationState } from "../operators.js";

export function keyword<N extends string>(content: N): Derivable<N, N> {
	const loweredContent = content.toLowerCase();

	return Object.create(null, {
		type: {
			value: `keyword: ${loweredContent}`,
		},
		derive: {
			enumerable: true,
			value(token: string): DerivationResult<N> {
				if (token.toLowerCase() !== loweredContent) {
					return {
						state: DerivationState.REJECTED,
					};
				}

				return {
					state: DerivationState.DONE,
					values: [token],
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
