import { alias } from "../structure/derivables/alias.js";
import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../structure/operators.js";

/**
 * @syntax "sideways" | "mixed" | "upright"
 * @see https://w3c.github.io/ttml2/#style-attribute-textOrientation
 */

export const TextOrientationGrammar = alias(
	"<text-orientation>",
	oneOf([
		//
		keyword("sideways"),
		keyword("mixed"),
		keyword("upright"),

		// Legacy values
		keyword("sideways-left"),
		keyword("sideways-right"),

		// SVG ignore value
		keyword("use-glyph-orientation"),
	]),
);
