import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../structure/operators.js";

/**
 * @syntax <font-weight> : "normal" | "bold"
 * @see https://w3c.github.io/ttml2/#style-attribute-fontWeight
 */
export const FontWeightGrammar = oneOf([
	//
	keyword("normal"),
	keyword("bold"),
]);
