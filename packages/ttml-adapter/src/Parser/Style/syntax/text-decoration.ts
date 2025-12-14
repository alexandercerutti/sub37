import { oneOf, someOf } from "../structure/operators.js";
import { keyword } from "../structure/derivables/keyword.js";

/**
 * @syntax \<text-decoration>
 * : "none"
 * | (("underline" | "noUnderline") || ("lineThrough" | "noLineThrough") || ("overline" | "noOverline"))
 *
 * @see https://w3c.github.io/ttml2/#style-value-text-decoration
 */
export const TextDecoration = oneOf([
	//
	keyword("none"),
	someOf([
		//
		oneOf([
			//
			keyword("underline"),
			keyword("noUnderline"),
		]),
		oneOf([
			//
			keyword("lineThrough"),
			keyword("noLineThrough"),
		]),
		oneOf([
			//
			keyword("overline"),
			keyword("noOverline"),
		]),
	]),
]);
