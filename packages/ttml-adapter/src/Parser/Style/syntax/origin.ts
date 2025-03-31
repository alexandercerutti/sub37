import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../structure/kleene.js";
import { toLength } from "../../Units/length.js";

/**
 * @syntax \<origin>
 *  : "auto"
 *  | \<length> \<lwsp> \<length>
 * @see https://w3c.github.io/ttml2/#style-value-origin
 */
export const Origin = createStyleNode(null, null, () => [
	createStyleNode("origin", "origin", () => [
		Kleene.or(
			createStyleNode("auto", "auto"),
			Kleene.ordered(
				//
				createStyleNode(
					"length",
					"x-origin",
					() => [],
					(value) => toLength(value)?.toString(),
				),
				createStyleNode(
					"length",
					"y-origin",
					() => [],
					(value) => toLength(value)?.toString(),
				),
			),
		),
	]),
]);
