import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { ColorGrammar } from "../syntax/color.js";

export const Grammar = alias("tts:backgroundColor", ColorGrammar);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof ColorGrammar>,
): PropertiesCollection<["background-color"]> | null {
	return [["background-color", value[0].value]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof ColorGrammar>[],
	_animationType: "discrete" | "continuous",
): boolean {
	// Color can be animated both continuously and discretely between any values
	return true;
}
