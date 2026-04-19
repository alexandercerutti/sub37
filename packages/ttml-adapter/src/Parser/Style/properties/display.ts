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
		/**
		 * Remapping to `"inline"` is not an explicit requirement of the spec,
		 * but the spec says:
		 *
		 * > If the value of this attribute is auto, then the affected element
		 * > is a candidate for region layout and presentation
		 *
		 * Which means we need inline for spans.
		 */
		if (elementAppliesTo === "span") {
			return [["display", "inline"]];
		}

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
