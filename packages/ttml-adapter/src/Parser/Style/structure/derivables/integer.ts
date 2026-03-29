import { DerivationState } from "../operators.js";
import type { DerivationResult, Derivable, DerivedValue } from "../operators.js";

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
