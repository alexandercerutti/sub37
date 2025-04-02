import { createStyleNode } from "./StyleNode.js";
import * as Kleene from "../../structure/kleene.js";
import { Color } from "./color.js";

/**
 * @syntax
 * 	: \<length> \<lwsp> \<length> (\<lwsp> \<color>)?
 * 	| \<length> \<lwsp> \<length> \<lwsp> \<length> (\<lwsp> \<color>)?
 *
 * @see https://w3c.github.io/ttml2/#style-value-shadow
 */
const Shadow = createStyleNode("shadow", "shadow", () => [
	Kleene.or(
		// \<length> \<lwsp> \<length> (\<lwsp> \<color>)?
		Kleene.ordered(
			createStyleNode("length", "offset-x"),
			createStyleNode("length", "offset-y"),
			Kleene.zeroOrOne(Color),
		),
		// \<length> \<lwsp> \<length> \<lwsp> \<length> (\<lwsp> \<color>)?
		Kleene.ordered(
			createStyleNode("length", "offset-x"),
			createStyleNode("length", "offset-y"),
			createStyleNode("length", "blur-radius"),
			Kleene.zeroOrOne(Color),
		),
	),
]);

/**
 * @syntax \<shadow> (\<lwsp>? "," \<lwsp>? \<shadow>)*
 * @see https://w3c.github.io/ttml2/#style-value-text-shadow
 */
export const TextShadow = createStyleNode("text-shadow", "text-shadow", () => [
	Kleene.ordered(Shadow, Kleene.zeroOrMore(Shadow)),
]);
