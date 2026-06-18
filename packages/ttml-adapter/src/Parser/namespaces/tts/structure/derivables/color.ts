import { isValidColor } from "../../primitives/color.js";
import type { Color } from "../../primitives/color.js";
import { DerivationState } from "../../../../structure/grammar.js";
import type { Derivable, DerivationResult, DerivedValue } from "../../../../structure/grammar.js";

export function color(): Derivable<"<color>", DerivedValue<"color", Color>> {
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
					values: [{ type: "color", value: token }],
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
