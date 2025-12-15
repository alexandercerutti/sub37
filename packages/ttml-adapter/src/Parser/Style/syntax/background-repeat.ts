import { alias } from "../structure/derivables/alias";
import { keyword } from "../structure/derivables/keyword";
import { oneOf } from "../structure/operators";

/**
 * @syntax "repeat" | "repeatX" | "repeatY" | "noRepeat"
 * @see https://w3c.github.io/ttml2/#style-attribute-backgroundRepeat
 */
export const Grammar = alias(
	"<background-repeat>",
	oneOf([
		//
		keyword("repeat"),
		keyword("repeatX"),
		keyword("repeatY"),
		keyword("noRepeat"),
	]),
);
