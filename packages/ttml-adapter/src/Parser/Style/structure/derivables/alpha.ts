import { Derivable, DerivationResult, DerivationState } from "../operators";

export function alpha(): Derivable<"<alpha>", number> {
	return Object.create(null, {
		type: {
			value: "<alpha>",
		},
		derive: {
			enumerable: true,
			value(token: string): DerivationResult<number> {
				const parsedValue = parseFloat(token);

				if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 1) {
					return {
						state: DerivationState.REJECTED,
						rejectionDetails: `${token} is not a valid alpha value`,
					};
				}

				return {
					state: DerivationState.DONE,
					values: [parsedValue],
				};
			},
		},
	});
}
