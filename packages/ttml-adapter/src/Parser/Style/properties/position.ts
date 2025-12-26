import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { PositionGrammar } from "../syntax/position.js";
import { normalizePositionValue } from "../syntax/position.js";

export { PositionGrammar as Grammar } from "../syntax/position.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof PositionGrammar>,
): string | null {
	normalizePositionValue(value);

	/**
	 * @TODO Process
	 */
	return null;
}
