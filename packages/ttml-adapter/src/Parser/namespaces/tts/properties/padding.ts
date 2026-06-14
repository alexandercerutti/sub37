import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { PaddingGrammar } from "../syntax/padding.js";

export const Grammar = alias("tts:padding", PaddingGrammar);

export function cssTransform(
	_scope: Scope,
	paddingValues: InferDerivableValue<typeof PaddingGrammar>,
): PropertiesCollection<["padding"]> | null {
	return [
		//
		["padding", paddingValues.map(({ value }) => value.toString()).join(" ")],
	];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof PaddingGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
