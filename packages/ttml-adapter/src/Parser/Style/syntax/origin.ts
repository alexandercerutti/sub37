import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../Tags/Representation/kleene.js";

/**
 * @syntax \<origin>
 *  : "auto"
 *  | \<length> \<lwsp> \<length>
 * @see https://w3c.github.io/ttml2/#style-value-origin
 */
export const Origin = createStyleNode("origin", "origin", () => [
	Kleene.or(
		createStyleNode("auto", "auto"),
		Kleene.ordered(
			//
			createStyleNode("length", "x-origin"),
			createStyleNode("length", "y-origin"),
		),
	),
]);
