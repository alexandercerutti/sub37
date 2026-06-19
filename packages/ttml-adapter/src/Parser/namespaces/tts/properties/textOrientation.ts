import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { TextOrientationGrammar } from "../syntax/text-orientation.js";

export const Grammar = alias("tts:textOrientation", TextOrientationGrammar);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextOrientationGrammar>,
): PropertiesCollection<["text-orientation"]> | null {
	switch (value[0].value) {
		// Kept only for compatibility. Remapping.
		case "sideways-left":
		case "sideways-right": {
			return [["text-orientation", "sideways"]];
		}

		case "use-glyph-orientation": {
			// Invalid, as it is used only for SVG
			return null;
		}
	}

	return [["text-orientation", value[0].value]];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof TextOrientationGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
