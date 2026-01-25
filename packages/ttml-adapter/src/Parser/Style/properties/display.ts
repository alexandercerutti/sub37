import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { DisplayGrammar } from "../syntax/display.js";

export { DisplayGrammar as Grammar } from "../syntax/display.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof DisplayGrammar>,
	elementAppliesTo: string,
): PropertiesCollection<["display"]> | null {
	if (value[0].value === "none") {
		return [
			/**
			 * This is to handle the `display: none` case when also `displayAlign` is set.
			 */
			["display", "none !important"],
		];
	}

	if (value[0].value === "auto") {
		return [["display", "flex"]];
	}

	if (value[0].value === "inlineBlock") {
		if (elementAppliesTo === "span") {
			return [["display", "inline-block"]];
		}

		throw new Error(
			"`inlineBlock` value for `tts:display` property can be applied only to `span` elements.",
		);
	}

	return null;
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof DisplayGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
