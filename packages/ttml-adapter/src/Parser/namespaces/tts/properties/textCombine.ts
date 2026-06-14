import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { TextCombineGrammar } from "../syntax/text-combine.js";

export const Grammar = alias("tts:textCombine", TextCombineGrammar);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextCombineGrammar>,
): PropertiesCollection<["text-combine-upright"]> {
	return [["text-combine-upright", value[0].value]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof TextCombineGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
