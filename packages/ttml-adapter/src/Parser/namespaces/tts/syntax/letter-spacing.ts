import { keyword } from "../structure/derivables/keyword.js";
import { length } from "../structure/derivables/length.js";
import { oneOf } from "../../../structure/grammar.js";

/**
 * @syntax "normal" | \<length>
 * @see https://w3c.github.io/ttml2/#style-attribute-letterSpacing
 */

export const LetterSpacingGrammar = oneOf([
	//
	keyword("normal"),
	length(),
]);
