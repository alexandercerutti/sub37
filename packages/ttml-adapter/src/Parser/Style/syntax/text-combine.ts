import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../Tags/Representation/kleene.js";

/**
 * @syntax "none" | "all"
 * @see https://w3c.github.io/ttml2/#style-value-text-combine
 */
export const TextCombine = createStyleNode("text-combine", "text-combine", () => [
	Kleene.or(
		//
		createStyleNode("none", "combine"),
		createStyleNode("all", "combine"),
	),
]);
