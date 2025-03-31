import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../structure/kleene.js";
import { Color } from "./color.js";
import { toLength } from "../../Units/length.js";

/**
 * @syntax "none" | (\<color> \<lwsp>)? \<length> (\<lwsp> \<length>)?
 * @see https://w3c.github.io/ttml2/#style-value-text-outline
 */
export const TextOutline = createStyleNode(null, null, () => [
	createStyleNode("text-outline", "text-outline", () => [
		Kleene.or(
			createStyleNode("none", "none"),
			Kleene.ordered(
				//
				Kleene.zeroOrOne(Color),
				createStyleNode("length", "thickness"),
				Kleene.zeroOrOne(
					createStyleNode(
						"length",
						"blur-radius",
						() => [],
						(value) => toLength(value)?.toString(),
					),
				),
			),
		),
	]),
]);
