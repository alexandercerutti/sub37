import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { OpacityGrammar } from "../syntax/opacity.js";

export const Grammar = alias("tts:opacity", OpacityGrammar);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof OpacityGrammar>,
): PropertiesCollection<["opacity"]> {
	return [["opacity", String(value[0].value)]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof OpacityGrammar>[],
	_animationType: "discrete" | "continuous",
): boolean {
	return true;
}
