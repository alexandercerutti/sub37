import { MeasureGrammar } from "./measure.js";
import { oneOf, sequence } from "../structure/operators.js";
import { keyword } from "../structure/derivables/keyword.js";
import { alias } from "../structure/derivables/alias.js";

/**
 * @syntax \<extent>
 *  : "auto"
 *  | "contain"
 *  | "cover"
 *  | \<measure> \<lwsp> \<measure>
 *
 * @see https://w3c.github.io/ttml2/#style-value-extent
 */
export const ExtentGrammar = alias(
	"<extent>",
	oneOf([
		keyword("auto"),
		keyword("contain"),
		keyword("cover"),
		sequence([
			//
			MeasureGrammar,
			MeasureGrammar,
		]),
	]),
);
