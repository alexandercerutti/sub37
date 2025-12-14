import { keyword } from "../structure/derivables/keyword";
import { oneOf } from "../structure/operators";

/**
 * @syntax "sideways" | "mixed" | "upright"
 * @see https://w3c.github.io/ttml2/#style-attribute-textOrientation
 */

export const Grammar = oneOf([
	//
	keyword("sideways"),
	keyword("mixed"),
	keyword("upright"),
]);
