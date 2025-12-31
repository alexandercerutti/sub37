import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../structure/operators.js";

/**
 * @syntax "before" | "center" | "after" | "justify"
 * @see https://w3c.github.io/ttml2/#style-attribute-displayAlign
 */
export const DisplayAlignGrammar = oneOf([
	//
	keyword("before"),
	keyword("center"),
	keyword("after"),
	keyword("justify"),
]);
