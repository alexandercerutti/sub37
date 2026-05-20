import { alias } from "../structure/derivables/alias.js";
import { keyword } from "../structure/derivables/keyword.js";
import { oneOf } from "../structure/operators.js";

/**
 * @syntax "repeat" | "repeatX" | "repeatY" | "noRepeat"
 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundRepeat
 */
export const BackgroundRepeatGrammar = alias(
	"<background-repeat>",
	oneOf([
		//
		keyword("repeat"),
		keyword("repeatX"),
		keyword("repeatY"),
		keyword("noRepeat"),
	]),
);
