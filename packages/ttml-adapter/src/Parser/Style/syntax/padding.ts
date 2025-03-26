import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../Tags/Representation/kleene.js";

/**
 * @syntax \<padding>
 *  : \<length> \<lwsp> \<length> \<lwsp> \<length> \<lwsp> \<length>
 *  | \<length> \<lwsp> \<length> \<lwsp> \<length>
 *  | \<length> \<lwsp> \<length>
 *  | \<length>
 * @see https://w3c.github.io/ttml2/#style-value-padding
 */
export const Padding = createStyleNode("padding", "padding", () => [
	Kleene.or(
		// Four values: top right bottom left
		Kleene.ordered(
			createStyleNode("length", "padding-top"),
			createStyleNode("length", "padding-right"),
			createStyleNode("length", "padding-bottom"),
			createStyleNode("length", "padding-left"),
		),

		// Three values: top right/left bottom
		Kleene.ordered(
			createStyleNode("length", "padding-top"),
			createStyleNode("length", "padding-right-left"),
			createStyleNode("length", "padding-bottom"),
		),

		// Two values: top/bottom right/left
		Kleene.ordered(
			createStyleNode("length", "padding-top-bottom"),
			createStyleNode("length", "padding-right-left"),
		),

		// One value: all sides
		createStyleNode("length", "padding-all"),
	),
]);
