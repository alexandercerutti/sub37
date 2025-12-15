import { DerivationState } from "../operators.js";
import type { DerivationResult, Derivable } from "../operators.js";

export function integer(): Derivable<"<integer>"> {
	return Object.create(null, {
		type: {
			value: "<integer>",
		},
		derive: {
			enumerable: true,
			value(token: string): DerivationResult {
				if (/^[+-]?\d+$/.test(token)) {
					return {
						state: DerivationState.DONE,
						values: [parseInt(token, 10)],
					};
				}

				return {
					state: DerivationState.REJECTED,
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
