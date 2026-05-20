import { oneOf, sequence, zeroOrMore, zeroOrOne } from "../structure/operators.js";
import { length, NonNegativeConstraint } from "../structure/derivables/length.js";
import { keyword } from "../structure/derivables/keyword.js";
import { color } from "../structure/derivables/color.js";
import { alias } from "../structure/derivables/alias.js";

/**
 * @syntax
 * 	: \<length> \<lwsp> \<length> (\<lwsp> \<color>)?
 * 	| \<length> \<lwsp> \<length> \<lwsp> \<length> (\<lwsp> \<color>)?
 *
 * @see https://w3c.github.io/ttml2/#style-value-shadow
 */
const Shadow = alias(
	"<shadow>",
	sequence([
		alias("offset-x", length()),
		alias("offset-y", length()),
		alias("blur-radius", zeroOrOne(length(NonNegativeConstraint))),
		alias("color", zeroOrOne(color())),
	]),
);

/**
 * @syntax \<shadow> (\<lwsp>? "," \<lwsp>? \<shadow>)*
 * @see https://w3c.github.io/ttml2/#style-value-text-shadow
 */
export const TextShadowGrammar = alias(
	"<text-shadow>",
	oneOf([
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
	]),
);
