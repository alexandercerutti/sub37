import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { DisplayAlignGrammar } from "../syntax/display-align.js";

export { DisplayAlignGrammar as Grammar } from "../syntax/display-align.js";

/**
 * This property mapper assumes the renderer has a flexbox-based layout.
 *
 * @param _scope
 * @param value
 * @returns
 */
export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof DisplayAlignGrammar>,
): PropertiesCollection<["justify-content"]> {
	switch (value[0].value) {
		case "before": {
			return [["justify-content", "flex-start"]];
		}

		case "center": {
			return [["justify-content", "center"]];
		}

		case "after": {
			return [["justify-content", "flex-end"]];
		}

		case "justify": {
			return [["justify-content", "space-between"]];
		}
	}
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof DisplayAlignGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
