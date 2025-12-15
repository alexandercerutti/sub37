import { oneOf, someOf } from "../structure/operators.js";
import { keyword } from "../structure/derivables/keyword.js";
import { QuotedString } from "../structure/derivables/quoted-string.js";
import { AnnotationColor, AnnotationPosition } from "../structure/derivables/annotation.js";
import { as } from "../structure/derivables/tag.js";

/**
 * @syntax \<emphasis-style>
 * 		| "none"
 * 		| "auto"
 * 		| ( "filled" | "open" ) || ( "circle" | "dot" | "sesame" )
 * 		| \<quoted-string>
 *
 * @see https://w3c.github.io/ttml2/#style-value-emphasis
 *
 * The semantics of text emphasis style values are defined as follows:
 *
 * "none" - No text emphasis mark.
 * "auto" - If a vertical writing mode applies, then equivalent to `filled
 * 					sesame`; otherwise, equivalent to `filled circle`.
 *
 * "filled" - Emphasis mark is filled with emphasis color.
 * "open" - Emphasis mark is not filled, i.e., its outline is stroked with
 * 					the emphasis color, but it is not filled.
 *
 * "circle" - Emphasis mark is a circle. If `filled`, then equivalent to U+25CF '●';
 * if open, then equivalent to U+25CB '○'
 *
 * "dot" - Emphasis mark is a dot. If `filled`, then equivalent to U+2022 '•';
 * 					if `open`, then equivalent to U+25E6 '◦'
 *
 * "sesame" - Emphasis mark is a sesame. If `filled`, then equivalent to U+FE45 '﹅';
 * 						if `open`, then equivalent to U+FE46 '﹆'
 *
 * `<quoted-string>` - Emphasis mark is the first grapheme cluster of string, with
 * 										remainder of string ignored.
 *
 * If only `filled` or `open` is specified, then it is equivalent to `filled circle`
 * and `open circle`, respectively.
 *
 * If only `circle`, `dot`, or `sesame` is specified, then it is equivalent to
 * `filled circle`, `filled dot`, and `filled sesame`, respectively.
 *
 * If an implementation does not recognize or otherwise distinguish an emphasis style
 * value, then it must be interpreted as if a style of auto were specified;
 * as such, an implementation that supports text emphasis marks must minimally support
 * the auto value.
 */
const EmphasisStyle = as(
	"text-emphasis-style",
	oneOf([
		keyword("none"),
		keyword("auto"),
		// ( "filled" | "open" ) || ( "circle" | "dot" | "sesame" )
		someOf([
			oneOf([
				//
				keyword("filled"),
				keyword("open"),
			]),
			oneOf([
				//
				keyword("circle"),
				keyword("dot"),
				keyword("sesame"),
			]),
		]),
		QuotedString,
	]),
);

const EmphasisPosition = as("text-emphasis-position", AnnotationPosition);
const EmphasisColor = as("text-emphasis-color", AnnotationColor);

/**
 * @syntax \<emphasis-style> || \<emphasis-color> || \<emphasis-position>
 * @see https://w3c.github.io/ttml2/#style-value-text-emphasis
 */
export const Grammar = someOf([
	//
	EmphasisStyle,
	EmphasisColor,
	EmphasisPosition,
]);
