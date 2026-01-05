import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { OriginGrammar } from "../syntax/origin.js";

export { OriginGrammar as Grammar } from "../syntax/origin.js";

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof OriginGrammar>,
): PropertiesCollection<["x", "y"]> {
	if (value[0].type === "keyword") {
		/**
		 * @TODO might be wrong
		 *
		 * "If the value of this attribute is auto,
		 * then the computed value of the style
		 * property must be considered to be the
		 * same as the origin of the root container
		 * region."
		 *
		 * But we don't have this detail. So this should
		 * be calculated by the region it self in renderer?
		 */
		return [
			["x", "0px"],
			["y", "0px"],
		];
	}

	return [
		["x", value[0].toString()],
		["y", value[1].toString()],
	];
}
