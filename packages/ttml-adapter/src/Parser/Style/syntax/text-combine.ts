import { oneOf } from "../structure/operators.js";
import { keyword } from "../structure/derivables/keyword.js";

/**
 * @syntax \<text-combine>
 * 	: "none"
 * 	| "all"
 *
 * @see https://w3c.github.io/ttml2/#style-value-text-combine
 */
export const Grammar = oneOf([
	//
	keyword("none"),
	keyword("all"),
]);
