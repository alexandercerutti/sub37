import { keyword } from "../structure/derivables/keyword";
import { oneOf } from "../structure/operators";

/**
 * @syntax "before" | "center" | "after" | "justify"
 * @see https://w3c.github.io/ttml2/#style-attribute-displayAlign
 */
export const Grammar = oneOf([
	//
	keyword("before"),
	keyword("center"),
	keyword("after"),
	keyword("justify"),
]);
