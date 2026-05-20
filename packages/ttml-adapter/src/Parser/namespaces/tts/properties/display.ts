import type { Scope } from "../../../Scope/Scope.js";
import type { PropertiesCollection } from "../../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { DisplayGrammar } from "../syntax/display.js";

export { DisplayGrammar as Grammar } from "../syntax/display.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof DisplayGrammar>,
	elementAppliesTo: string,
): PropertiesCollection<["display"]> | null {
	if (value[0].value === "none") {
		return [["display", "none"]];
	}

	if (value[0].value === "auto") {
		if (elementAppliesTo === "span") {
			return [["display", "inline"]];
		}

		if (elementAppliesTo === "region") {
			/**
			 * Even if the renderer already has a flex layout for regions as a structural
			 * invariant, we still emit it here so animation keyframes targeting `auto` have
			 * a concrete CSS value to restore to (CSS animations need an explicit value).
			 * This is not a standard requirement, but it is a practical necessity given
			 * the current implementation of the renderer and conflict with tts:displayAlign's
			 * mapping.
			 */
			return [["display", "flex"]];
		}

		/**
		 * For block elements (body, div, p), `auto` means "participate normally in layout".
		 * We emit `display: block` explicitly rather than `null` so that animation keyframes
		 * targeting `auto` have a concrete CSS value to restore to when animating from `none`.
		 */
		return [["display", "block"]];
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
