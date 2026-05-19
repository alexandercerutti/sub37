import { keyword } from "../structure/derivables/keyword";
import { oneOf } from "../structure/operators";

/**
 * @syntax visibility
 * @see https://w3c.github.io/ttml2/#style-value-visibility
 */
export const VisibilityGrammar = oneOf([
	//
	keyword("visible"),
	keyword("hidden"),
]);
