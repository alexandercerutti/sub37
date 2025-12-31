import type { PropertiesCollection } from "../../parseStyle.js";
import type { Scope } from "../../Scope/Scope.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { TextOrientationGrammar } from "../syntax/text-orientation.js";

export { TextOrientationGrammar as Grammar } from "../syntax/text-orientation.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof TextOrientationGrammar>,
): PropertiesCollection<["text-orientation"]> | null {
	switch (value[0]) {
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

	return [["text-orientation", value[0]]];
}
