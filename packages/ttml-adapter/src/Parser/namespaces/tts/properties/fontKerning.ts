import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { FontKerningGrammar } from "../syntax/font-kerning.js";

export { FontKerningGrammar as Grammar } from "../syntax/font-kerning.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof FontKerningGrammar>,
): PropertiesCollection<["font-kerning"]> | null {
	return [["font-kerning", value[0].value]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof FontKerningGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
