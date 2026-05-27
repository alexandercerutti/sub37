import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { TextAlignGrammar } from "../syntax/text-align.js";

export const Grammar = alias("tts:textAlign", TextAlignGrammar);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextAlignGrammar>,
): PropertiesCollection<["text-align"]> | null {
	return [["text-align", value[0].value]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof TextAlignGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
