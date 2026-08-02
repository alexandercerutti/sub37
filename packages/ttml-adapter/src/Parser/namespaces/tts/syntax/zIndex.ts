import { integer } from "../structure/derivables/integer.js";
import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../../../structure/grammar.js";

/**
 * @syntax \<z-index>
 * @see https://w3c.github.io/ttml2/#style-value-z-index
 */
export const zIndexGrammar = oneOf([
	//
	keyword("auto"),
	integer(),
]);
