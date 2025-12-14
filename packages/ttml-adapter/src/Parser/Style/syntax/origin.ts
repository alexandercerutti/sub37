import { keyword } from "../structure/derivables/keyword.js";
import { oneOf, sequence } from "../structure/operators.js";
import { length } from "../structure/derivables/length.js";

/**
 * @syntax \<origin>
 *  : "auto"
 *  | \<length> \<lwsp> \<length>
 * @see https://w3c.github.io/ttml2/#style-value-origin
 */
export const Grammar = oneOf([
	//
	keyword("auto"),
	sequence([
		// x
		length(),
		// y
		length(),
	]),
]);
