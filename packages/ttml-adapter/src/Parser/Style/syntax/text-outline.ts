import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import { keyword } from "../structure/derivables/keyword.js";
import { oneOf, sequence, zeroOrOne } from "../structure/operators.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { color } from "../structure/derivables/color.js";
import { length } from "../structure/derivables/length.js";
import { alias } from "../structure/derivables/alias.js";
import { as } from "../structure/derivables/tag.js";

/**
 * @syntax "none" | (\<color> \<lwsp>)? \<length> (\<lwsp> \<length>)?
 * @see https://w3c.github.io/ttml2/#style-value-text-outline
 */
export const Grammar = alias(
	"<text-outline>",
	oneOf([
		keyword("none"),
		sequence([
			//
			zeroOrOne(as("outline-color", color())),
			// Thickness
			as("outline-thickness", length()),
			zeroOrOne(
				// Blur radius
				as("outline-blur-radius", length()),
			),
		]),
	]),
);

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof Grammar>,
): PropertiesCollection<["text-shadow", "-webkit-text-stroke"]> | null {
	if (value[0] === "none") {
		return [
			["text-shadow", "none"],
			["-webkit-text-stroke", "0 currentColor"],
		];
	}

	const [outlineColor, outlineThickness, outlineBlurRadius] = value;

	return [
		["text-shadow", `${outlineColor} 1px 1px ${outlineBlurRadius}`],
		["-webkit-text-stroke", `${outlineThickness} ${outlineColor}`],
	];
}
