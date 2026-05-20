import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../structure/operators.js";

/**
 * @syntax font-style
 * @see https://w3c.github.io/ttml2/#style-value-font-style
 */
export const FontStyleGrammar = oneOf([keyword("normal"), keyword("italic"), keyword("oblique")]);
