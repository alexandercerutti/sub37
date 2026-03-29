import { oneOf, sequence } from "../structure/operators.js";
import { length } from "../structure/derivables/length.js";
import { alias } from "../structure/derivables/alias.js";

/**
 * @syntax \<padding>
 *  : \<length> \<lwsp> \<length> \<lwsp> \<length> \<lwsp> \<length>
 *  | \<length> \<lwsp> \<length> \<lwsp> \<length>
 *  | \<length> \<lwsp> \<length>
 *  | \<length>
 * @see https://w3c.github.io/ttml2/#style-value-padding
 */
export const PaddingGrammar = oneOf([
	// Four values: top right bottom left
	sequence([
		alias("padding-top", length()),
		alias("padding-right", length()),
		alias("padding-bottom", length()),
		alias("padding-left", length()),
	]),

	// Three values: top right/left bottom
	sequence([
		alias("padding-top", length()),
		alias("padding-right-left", length()),
		alias("padding-bottom", length()),
	]),

	// Two values: top/bottom right/left
	sequence([
		//
		alias("padding-top-bottom", length()),
		alias("padding-right-left", length()),
	]),

	// One value: all sides
	length(),
]);
