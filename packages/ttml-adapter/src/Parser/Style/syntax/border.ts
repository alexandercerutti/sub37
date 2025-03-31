import * as Kleene from "../../structure/kleene.js";
import { isPercentage, toLength } from "../../Units/length.js";
import { getSplittedLinearWhitespaceValues } from "../../Units/lwsp.js";
import { createUnit } from "../../Units/unit.js";
import { Color } from "./color.js";
import { createStyleNode } from "./StyleNode.js";

function processBorderThicknessLength(component: string) {
	const borderThicknessLength = toLength(component);

	if (!borderThicknessLength || isPercentage(borderThicknessLength)) {
		return undefined;
	}

	return borderThicknessLength.toString();
}

/**
 * @syntax thin | medium | thick | \<length>
 * @see https://w3c.github.io/ttml2/#style-value-border-thickness
 */
const BorderThickness = createStyleNode("border-thickness", "border-thickness", () => [
	Kleene.or(
		createStyleNode("thin", "thickness"),
		createStyleNode("medium", "thickness"),
		createStyleNode("thick", "thickness"),
		createStyleNode("length", "thickness", () => [], processBorderThicknessLength),
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
 *
 * @param component
 * @returns
 */

function validateBorderRadii(component: string): string {
	if (!component.startsWith("radii(")) {
		return "";
	}

	const startParenthesisIndex = component.indexOf("(");
	const endParenthesisIndex = component.lastIndexOf(")");
	const splittedSections = component
		.substring(startParenthesisIndex + 1, endParenthesisIndex)
		.split(",");

	if (!splittedSections.length) {
		return "";
	}

	const firstQuarterEllipseRadius = splittedSections[0].trim();
	const secondQuarterEllipseRadius = (splittedSections[1] || firstQuarterEllipseRadius).trim();

	const fqerAsLength = toLength(firstQuarterEllipseRadius);

	if (!fqerAsLength) {
		return "";
	}

	const sqerAsLength = toLength(secondQuarterEllipseRadius) || createUnit(0, "px");

	return `${fqerAsLength.toString()} ${sqerAsLength.toString()}`;
}

/**
 * @syntax radii(" \<lwsp>? \<length> ( \<lwsp>? "," \<lwsp>? \<length> )? \<lwsp>? ")"
 *
 * If two \<length> expressions are specified, then the first length corresponds
 * to the quarter ellipse radius for the inline progression dimension (for content)
 * or horizontal direction (for regions), while the second length, if present,
 * corresponds to the quarter ellipse radius for the block progression dimension
 * (for content) or vertical direction (for regions), or, if only one length is
 * present, then it is interpreted as if two lengths were specified with the same
 * value.
 */
const BorderRadii = createStyleNode("border-radii", "border-radius", () => [], validateBorderRadii);

function BorderProcessor(attribute: string): string[] {
	return getSplittedLinearWhitespaceValues(attribute);
}

/**
 * @syntax \<border-thickness> || \<border-style> || \<border-color> || \<border-radii>
 * @see https://w3c.github.io/ttml2/#style-value-border
 */
export const Border = createStyleNode(null, null, () => [
	createStyleNode(
		"border",
		"border",
		() => [
			Kleene.or(
				Kleene.zeroOrOne(BorderThickness),
				Kleene.zeroOrOne(BorderStyle),
				Kleene.zeroOrOne(BorderColor),
				Kleene.zeroOrOne(BorderRadii),
			),
		],
		BorderProcessor,
	),
]);
