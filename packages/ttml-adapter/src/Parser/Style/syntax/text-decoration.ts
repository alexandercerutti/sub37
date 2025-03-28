import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../structure/kleene.js";

/**
 * @syntax \<text-decoration>
 * : "none"
 * | (("underline" | "noUnderline") || ("lineThrough" | "noLineThrough") || ("overline" | "noOverline"))
 *
 * @see https://w3c.github.io/ttml2/#style-value-text-decoration
 */
export const TextDecoration = createStyleNode(null, null, () => [
	createStyleNode("text-decoration", "text-decoration", () => [
		Kleene.or(
			createStyleNode("none", "none"),
			Kleene.ordered(
				Kleene.or(
					createStyleNode("underline", "underline"),
					createStyleNode("noUnderline", "no-underline"),
				),
				Kleene.or(
					createStyleNode("lineThrough", "line-through"),
					createStyleNode("noLineThrough", "no-line-through"),
				),
				Kleene.or(
					createStyleNode("overline", "overline"),
					createStyleNode("noOverline", "no-overline"),
				),
			),
		),
	]),
]);
