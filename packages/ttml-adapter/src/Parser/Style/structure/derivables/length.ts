import { isPercentage, isScalar, toLength } from "../../../Units/length.js";
import type { Length } from "../../../Units/length.js";
import { DerivationState } from "../operators.js";
import type { Derivable, DerivationResult } from "../operators.js";

export type ConstaintValidator = (value: Length) => boolean;

export const PositiveConstraint: ConstaintValidator = (length) => length.value > 0;
export const NonNegativeConstraint: ConstaintValidator = (length) => length.value >= 0;

export const PercentageConstraint: ConstaintValidator = isPercentage;
export const ScalarConstraint: ConstaintValidator = isScalar;

export function length(...constraints: ConstaintValidator[]): Derivable<"<length>", Length> {
	return Object.create(null, {
		type: {
			value: "<length>",
		},
		derive: {
			enumerable: true,
			value(token: string): DerivationResult {
				const parsedLength = toLength(token);

				if (!parsedLength) {
					return {
						state: DerivationState.REJECTED,
						rejectionDetails: `${token} is not a length`,
					};
				}

				for (const validator of constraints) {
					if (!validator(parsedLength)) {
						return {
							state: DerivationState.REJECTED,
							rejectionDetails: `Length constraint validation failed for ${token}`,
						};
					}
				}

				return {
					state: DerivationState.DONE,
					values: [parsedLength],
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}
