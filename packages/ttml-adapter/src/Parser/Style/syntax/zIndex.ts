import { integer } from "../structure/derivables/integer";
import { keyword } from "../structure/derivables/keyword";
import { oneOf } from "../structure/operators";

/**
 * @syntax \<z-index>
 * @see https://w3c.github.io/ttml2/#style-value-z-index
 */
export const zIndexGrammar = oneOf([
	//
	keyword("auto"),
	integer(),
]);
