import type { Derivable, DerivationResult, DerivedValue } from "../../../../structure/grammar.js";
import { DerivationState } from "../../../../structure/grammar.js";

export function keyword<N extends string>(content: N): Derivable<N, DerivedValue<"keyword", N>> {
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
						rejectionDetails: `Expected keyword ${loweredContent}, got ${token}`,
					};
				}

				return {
					state: DerivationState.DONE,
					values: [{ type: "keyword", value: token }],
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
