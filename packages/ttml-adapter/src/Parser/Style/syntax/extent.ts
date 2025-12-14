import { Measure } from "./measure.js";
import { oneOf, sequence } from "../structure/operators.js";
import { keyword } from "../structure/derivables/keyword.js";

/**
 * @syntax \<extent>
 *  : "auto"
 *  | "contain"
 *  | "cover"
 *  | \<measure> \<lwsp> \<measure>
 *
 * @see https://w3c.github.io/ttml2/#style-value-extent
 */
export const Extent = oneOf([
	keyword("auto"),
	keyword("contain"),
	keyword("cover"),
	sequence([
		//
		Measure,
		Measure,
	]),
]);
