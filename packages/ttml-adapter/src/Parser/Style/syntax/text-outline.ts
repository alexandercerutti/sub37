import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../Tags/Representation/kleene.js";
import { Color } from "./Color.js";

/**
 * @syntax "none" | (\<color> \<lwsp>)? \<length> (\<lwsp> \<length>)?
 * @see https://w3c.github.io/ttml2/#style-value-text-outline
 */
export const TextOutline = createStyleNode("text-outline", "text-outline", () => [
	Kleene.or(
		createStyleNode("none", "none"),
		Kleene.ordered(
			//
			Kleene.zeroOrOne(Color),
			createStyleNode("length", "thickness"),
			Kleene.zeroOrOne(createStyleNode("length", "blur-radius")),
		),
	),
]);
