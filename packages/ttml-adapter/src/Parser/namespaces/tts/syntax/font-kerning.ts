import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../../../structure/grammar.js";

/**
 * @syntax "none" | "normal"
 * @see https://w3c.github.io/ttml2/#style-attribute-fontKerning
 */

export const FontKerningGrammar = oneOf([
	//
	keyword("none"),
	keyword("normal"),
]);
