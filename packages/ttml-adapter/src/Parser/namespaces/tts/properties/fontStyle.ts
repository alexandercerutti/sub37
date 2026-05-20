import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { FontStyleGrammar } from "../syntax/font-style.js";

export { FontStyleGrammar as Grammar } from "../syntax/font-style.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof FontStyleGrammar>,
): PropertiesCollection<["font-style"]> | null {
	return [["font-style", String(value[0].value)]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof FontStyleGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
