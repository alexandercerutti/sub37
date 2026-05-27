import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { zIndexGrammar } from "../syntax/zIndex.js";

export const Grammar = alias("tts:zIndex", zIndexGrammar);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof zIndexGrammar>,
): PropertiesCollection<["z-index"]> | null {
	return [["z-index", String(value[0].value)]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof zIndexGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
