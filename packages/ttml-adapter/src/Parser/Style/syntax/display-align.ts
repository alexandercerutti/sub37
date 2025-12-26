import { keyword } from "../structure/derivables/keyword.js";
import { as } from "../structure/derivables/tag.js";
import { oneOf } from "../structure/operators.js";

/**
 * @syntax "before" | "center" | "after" | "justify"
 * @see https://w3c.github.io/ttml2/#style-attribute-displayAlign
 */
export const DisplayAlignGrammar = as(
	"justify-content",
	oneOf([
		//
		keyword("before"),
		keyword("center"),
		keyword("after"),
		keyword("justify"),
	]),
);
