import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { DisplayGrammar } from "../syntax/display.js";

export { DisplayGrammar as Grammar } from "../syntax/display.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof DisplayGrammar>,
): PropertiesCollection<["display"]> | null {
	if (value[0] === "none") {
		return [
			/**
			 * This is to handle the `display: none` case when also `displayAlign` is set.
			 */
			["display", "none !important"],
		];
	}

	if (value[0] === "auto") {
		return [["display", "flex"]];
	}

	if (value[0] === "inlineBlock") {
		/**
		 * @TODO Add check on element this is being applied to.
		 */
		return [["display", "inline-block"]];
	}

	return null;
}
