import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { FontWeightGrammar } from "../syntax/font-weight.js";

export { FontWeightGrammar as Grammar } from "../syntax/font-weight.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof FontWeightGrammar>,
): PropertiesCollection<["font-weight"]> | null {
	return [["font-weight", String(value[0].value)]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof FontWeightGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
