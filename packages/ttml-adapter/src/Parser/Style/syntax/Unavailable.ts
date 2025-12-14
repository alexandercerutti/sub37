import { DerivationState } from "../structure/operators.js";
import type { Derivable, DerivationResult } from "../structure/operators.js";

/**
 * This syntax acts like a placeholder, because
 * we might not have implemented or won't implement
 * a certain syntax.
 */
export const Unavailable = (function (): Derivable {
	return Object.create(null, {
		symbol: {
			value: Symbol("unavailable"),
		},
		derive: {
			value(): DerivationResult {
				return {
					state: DerivationState.REJECTED,
				};
			},
		},
	});
})();
