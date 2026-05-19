import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { VisibilityGrammar } from "../syntax/visibility.js";

export { VisibilityGrammar as Grammar } from "../syntax/visibility.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof VisibilityGrammar>,
): PropertiesCollection<["visibility"]> | null {
	return [["visibility", String(value[0].value)]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof VisibilityGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
