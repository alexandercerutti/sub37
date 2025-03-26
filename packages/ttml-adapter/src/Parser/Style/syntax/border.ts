import * as Kleene from "../../structure/kleene.js";
import { Color } from "./Color.js";
import { createStyleNode } from "./StyleNode.js";

/**
 * @syntax thin | medium | thick | \<length>
 * @see https://w3c.github.io/ttml2/#style-value-border-thickness
 */
const BorderThickness = createStyleNode("border-thickness", "border-thickness", () => [
	Kleene.or(
		createStyleNode("thin", "thickness"),
		createStyleNode("medium", "thickness"),
		createStyleNode("thick", "thickness"),
		createStyleNode("length", "thickness"),
	),
]);

/**
 * @syntax \<color>
 * @see https://w3c.github.io/ttml2/#style-value-border-color
 */
const BorderColor = Color;

/**
 * @syntax none | dotted | dashed | solid | double
 * @see https://w3c.github.io/ttml2/#style-value-border-style
 */
const BorderStyle = createStyleNode("border-style", "border-style", () => [
	Kleene.or(
		createStyleNode("none", "style"),
		createStyleNode("dotted", "style"),
		createStyleNode("dashed", "style"),
		createStyleNode("solid", "style"),
		createStyleNode("double", "style"),
	),
]);

/**
 * @syntax \<border-thickness> || \<border-style> || \<border-color> || \<border-radii>
 * @see https://w3c.github.io/ttml2/#style-value-border
 */
export const Border = createStyleNode("border", "border", () => [
	Kleene.or(
		Kleene.zeroOrOne(BorderThickness),
		Kleene.zeroOrOne(BorderStyle),
		Kleene.zeroOrOne(BorderColor),
		Kleene.zeroOrOne(createStyleNode("border-radii", "radius")),
	),
]);
