import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { VisibilityGrammar } from "../syntax/visibility.js";

export const Grammar = alias("tts:visibility", VisibilityGrammar);

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
