import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { FontStyleGrammar } from "../syntax/font-style.js";

export const Grammar = alias("tts:fontStyle", FontStyleGrammar);

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
