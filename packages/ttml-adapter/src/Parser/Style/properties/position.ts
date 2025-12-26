import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { PositionGrammar } from "../syntax/position.js";
import { normalizePositionValue } from "../syntax/position.js";

export { PositionGrammar as Grammar } from "../syntax/position.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof PositionGrammar>,
): PropertiesCollection<["position", "left", "top"]> | null {
	const normalizedValue = normalizePositionValue(value);

	if (!normalizedValue) {
		return null;
	}

	return [
		["position", "absolute"],
		["left", normalizedValue[1].toString()],
		["top", normalizedValue[3].toString()],
	];
}
