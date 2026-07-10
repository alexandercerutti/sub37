import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../../../structure/grammar.js";

/**
 * @syntax visibility
 * @see https://w3c.github.io/ttml2/#style-value-visibility
 */
export const VisibilityGrammar = oneOf([
	//
	keyword("visible"),
	keyword("hidden"),
]);
