import { isScalar, toLength } from "../../../Units/length";
import type { Length } from "../../../Units/length";
import { DerivationState } from "../operators";
import type { Derivable } from "../operators";

export type ConstaintValidator = (value: Length) => boolean;

export const PositiveConstraint: ConstaintValidator = (length) => length.value > 0;
export const NonNegativeConstraint: ConstaintValidator = (length) => length.value >= 0;

export const PercentageConstraint: ConstaintValidator = (length) => length.metric === "%";
export const ScalarConstraint: ConstaintValidator = isScalar;

export function length(...constraints: ConstaintValidator[]): Derivable<"<length>"> {
	return Object.create(null, {
		type: {
			value: "<length>",
		},
		derive: {
			enumerable: true,
			value(token: string) {
				const parsedLength = toLength(token);

				if (!parsedLength) {
					return {
						state: DerivationState.REJECTED,
					};
				}

				for (const validator of constraints) {
					if (!validator(parsedLength)) {
						return {
							state: DerivationState.REJECTED,
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
