import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { createUnit } from "../../../Unit.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { LetterSpacingGrammar } from "../syntax/letter-spacing.js";

export const Grammar = alias("tts:letterSpacing", LetterSpacingGrammar);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof LetterSpacingGrammar>,
): PropertiesCollection<["letter-spacing"]> | null {
	if (value[0].type === "keyword") {
		return [["letter-spacing", String(createUnit(0, "px"))]];
	}

	return [["letter-spacing", String(value[0].value)]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof LetterSpacingGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
