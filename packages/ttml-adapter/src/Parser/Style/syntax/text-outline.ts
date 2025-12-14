import { keyword } from "../structure/derivables/keyword.js";
import { oneOf, sequence, zeroOrOne } from "../structure/operators.js";
import { color } from "../structure/derivables/color.js";
import { length } from "../structure/derivables/length.js";

/**
 * @syntax "none" | (\<color> \<lwsp>)? \<length> (\<lwsp> \<length>)?
 * @see https://w3c.github.io/ttml2/#style-value-text-outline
 */
export const Grammar = oneOf([
	keyword("none"),
	sequence([
		//
		zeroOrOne(color()),
		// Thickness
		length(),
		zeroOrOne(
			// Blur radius
			length(),
		),
	]),
]);
