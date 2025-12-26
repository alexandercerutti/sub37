import { DerivationState } from "../structure/operators.js";
import type { Derivable, DerivationResult } from "../structure/operators.js";

/**
 * This syntax acts like a placeholder, because
 * we might not have implemented or won't implement
 * a certain syntax.
 */
export const UnavailableGrammar = (function (): Derivable {
	return Object.create(null, {
		type: {
			value: "unavailable",
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
