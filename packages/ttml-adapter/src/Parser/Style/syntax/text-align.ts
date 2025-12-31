import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../structure/operators.js";

/**
 * @syntax "sideways" | "mixed" | "upright"
 * @see https://w3c.github.io/ttml2/#style-attribute-textAlign
 */

export const TextAlignGrammar = oneOf([
	keyword("left"),
	keyword("right"),
	keyword("center"),
	keyword("justify"),
	keyword("start"),
	keyword("end"),
]);
