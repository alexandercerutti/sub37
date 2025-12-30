import { isValidColor } from "../../../Units/color.js";
import type { Color } from "../../../Units/color.js";
import { DerivationState } from "../operators.js";
import type { Derivable, DerivationResult } from "../operators.js";

export function color(): Derivable<"<color>", Color> {
	return Object.create(null, {
		type: {
			value: "<color>",
		},
		derive: {
			enumerable: true,
			value(token: string): DerivationResult {
				if (!isValidColor(token)) {
					return {
						state: DerivationState.REJECTED,
						rejectionDetails: `${token} is not a valid color`,
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
