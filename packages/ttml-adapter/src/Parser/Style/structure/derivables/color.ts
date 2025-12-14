import { isValidColor } from "../../../Units/color.js";
import { DerivationState } from "../operators.js";
import type { Derivable, DerivationResult } from "../operators.js";

export function color(): Derivable<"<color>"> {
	return Object.create(null, {
		symbol: {
			value: Symbol("<color>"),
		},
		derive: {
			enumerable: true,
			value(token: string): DerivationResult {
				if (!isValidColor(token)) {
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
