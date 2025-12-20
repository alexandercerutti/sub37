import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import { oneOf, someOf } from "../structure/operators.js";
import { keyword } from "../structure/derivables/keyword.js";
import { alias } from "../structure/derivables/alias.js";

/**
 * @syntax \<text-decoration>
 * : "none"
 * | (("underline" | "noUnderline") || ("lineThrough" | "noLineThrough") || ("overline" | "noOverline"))
 *
 * @see https://w3c.github.io/ttml2/#style-value-text-decoration
 */
export const Grammar = alias(
	"<text-decoration>",
	oneOf([
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
	]),
);

/**
 * @TODO TTML allows several values that CSS do not expect,
 * like `"noUnderline"`, `"noLineThrough"`, `"noOverline"`.
 *
 * However, resetting text-decoration is a difficult matter, as
 * it requires creating a span and setting it to have
 * `display: inline-block`.
 *
 * This is important as introducing such style, might compromise
 * the whole rendering in the captions-renderer.
 *
 * Further tests should be performed.
 *
 * Just for reference for when this will be implemented, to perform
 * a reset of text-decoration and apply a different effect, two nested
 * spans should be produced:
 *
 * @example
 * ```html
 * <div style="text-decoration: underline">
 * 	<p>
 * 		Lorem ipsum dolor sit amet, consectetur
 * 		<span style="text-decoration: none; display: inline-block">
 * 			<span style="text-decoration: line-through"> adipiscing elit </span>
 * 		</span>
 * 	</p>
 * 	. Curabitur tempor vitae augue lobortis rutrum. Nam nisi enim, lobortis
 * </div>
 * ```
 *
 * Producing two spans would mean, probably, to emit a "style reset entity"
 * or something like that.
 *
 * As this is right now too complex to achieve, I rathered to disable
 * the `text-decoration` property at all. Sorry folks.
 *
 * @see https://www.w3.org/TR/ttml2/#style-attribute-textDecoration
 */

export function cssTransform(_scope: Scope, _value: string): PropertiesCollection<[]> | null {
	// See note above
	return null;
}
