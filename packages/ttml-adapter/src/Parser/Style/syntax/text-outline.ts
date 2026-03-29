import { keyword } from "../structure/derivables/keyword.js";
import { oneOf, sequence, zeroOrOne } from "../structure/operators.js";
import { color } from "../structure/derivables/color.js";
import { length } from "../structure/derivables/length.js";
import { alias } from "../structure/derivables/alias.js";
import { as } from "../structure/derivables/tag.js";

/**
 * @syntax "none" | (\<color> \<lwsp>)? \<length> (\<lwsp> \<length>)?
 * @see https://w3c.github.io/ttml2/#style-value-text-outline
 */
export const TextOutlineGrammar = alias(
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
