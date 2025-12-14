import { oneOf, sequence } from "../structure/operators.js";
import { length } from "../structure/derivables/length.js";

// function PaddingProcessor(value: string) {
// 	return getSplittedLinearWhitespaceValues(value);
// }

/**
 * @syntax \<padding>
 *  : \<length> \<lwsp> \<length> \<lwsp> \<length> \<lwsp> \<length>
 *  | \<length> \<lwsp> \<length> \<lwsp> \<length>
 *  | \<length> \<lwsp> \<length>
 *  | \<length>
 * @see https://w3c.github.io/ttml2/#style-value-padding
 */
export const Grammar = oneOf([
	// Four values: top right bottom left
	sequence([
		length(), // padding-top
		length(), // padding-right
		length(), // padding-bottom
		length(), // padding-left
	]),

	// Three values: top right/left bottom
	sequence([
		length(), // padding-top
		length(), // padding-right-left
		length(), // padding-bottom
	]),

	// Two values: top/bottom right/left
	sequence([
		length(), // padding-top-bottom
		length(), // padding-right-left
	]),

	// One value: all sides
	length(),
]);
