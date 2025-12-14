import { oneOf, sequence, zeroOrMore, zeroOrOne } from "../structure/operators.js";
import { length, NonNegativeConstraint } from "../structure/derivables/length.js";
import { keyword } from "../structure/derivables/keyword.js";
import { color } from "../structure/derivables/color.js";

/**
 * @syntax
 * 	: \<length> \<lwsp> \<length> (\<lwsp> \<color>)?
 * 	| \<length> \<lwsp> \<length> \<lwsp> \<length> (\<lwsp> \<color>)?
 *
 * @see https://w3c.github.io/ttml2/#style-value-shadow
 */
const Shadow = sequence([
	// offset-x
	length(),
	// offset-y
	length(),
	// blur-radius
	zeroOrOne(length(NonNegativeConstraint)),
	// color
	zeroOrOne(color()),
]);

/**
 * @syntax \<shadow> (\<lwsp>? "," \<lwsp>? \<shadow>)*
 * @see https://w3c.github.io/ttml2/#style-value-text-shadow
 */
export const TextShadow = oneOf([
	keyword("none"),
	sequence([
		//
		Shadow,
		zeroOrMore(
			sequence([
				//
				keyword(","),
				Shadow,
			]),
		),
	]),
]);
