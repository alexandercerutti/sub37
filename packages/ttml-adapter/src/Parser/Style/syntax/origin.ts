import { keyword } from "../structure/derivables/keyword.js";
import { oneOf, sequence } from "../structure/operators.js";
import { length } from "../structure/derivables/length.js";
import { alias } from "../structure/derivables/alias.js";

/**
 * @syntax \<origin>
 *  : "auto"
 *  | \<length> \<lwsp> \<length>
 * @see https://w3c.github.io/ttml2/#style-value-origin
 */
export const OriginGrammar = alias(
	"<origin>",
	oneOf([
		//
		keyword("auto"),
		sequence([
			//
			alias("origin-x", length()),
			alias("origin-y", length()),
		]),
	]),
);
