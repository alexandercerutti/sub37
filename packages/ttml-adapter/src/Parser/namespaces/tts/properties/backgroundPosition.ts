import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { normalizePositionValue } from "../syntax/position.js";
import { PositionGrammar } from "../syntax/position.js";

export const Grammar = alias("tts:backgroundPosition", PositionGrammar);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof PositionGrammar>,
): PropertiesCollection<["background-position"]> | null {
	const normalizedValue = normalizePositionValue(value);

	if (!normalizedValue) {
		return null;
	}

	return [
		[
			"background-position",
			// left <length> top <length>
			`${normalizedValue[0]} ${normalizedValue[1].toString()} ${normalizedValue[2]} ${normalizedValue[3].toString()}`,
		],
	];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof PositionGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
