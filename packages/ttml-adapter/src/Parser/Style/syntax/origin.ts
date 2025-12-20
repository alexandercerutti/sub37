import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { Length } from "../../Units/length.js";
import { keyword } from "../structure/derivables/keyword.js";
import { oneOf, sequence } from "../structure/operators.js";
import { length } from "../structure/derivables/length.js";
import { alias } from "../structure/derivables/alias.js";

/**
 * @syntax \<origin>
 *  : "auto"
 *  | \<length> \<lwsp> \<length>
 * @see https://w3c.github.io/ttml2/#style-value-origin
 */
export const Grammar = alias(
	"<origin>",
	oneOf([
		//
		keyword("auto"),
		sequence([
			//
			alias("origin-x", length()),
			alias("origin-y", length()),
		]),
	]),
);

export function cssTransform(
	_scope: Scope,
	value: "auto" | [Length, Length],
): PropertiesCollection<["x", "y"]> {
	if (value === "auto") {
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
