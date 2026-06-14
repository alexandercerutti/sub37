import { DerivationState } from "../../../../structure/grammar.js";
import type { DerivationResult, Derivable, DerivedValue } from "../../../../structure/grammar.js";

export function integer(): Derivable<"<integer>", DerivedValue<"integer", number>> {
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
						values: [{ type: "integer", value: parseInt(token, 10) }],
					};
				}

				return {
					state: DerivationState.REJECTED,
					rejectionDetails: `${token} is not an integer`,
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
