import type { Scope } from "../../Scope/Scope.js";
import { isLength, toLength } from "../../Units/length.js";
import { createUnit } from "../../Units/unit.js";
import { as } from "../structure/derivables/tag.js";
import { color } from "../structure/derivables/color.js";
import { keyword } from "../structure/derivables/keyword.js";
import { length, ScalarConstraint } from "../structure/derivables/length.js";
import {
	Derivable,
	DerivationResult,
	DerivationState,
	InferDerivableValue,
	oneOf,
	someOf,
} from "../structure/operators.js";
import { PropertiesCollection } from "../../parseStyle.js";

/**
 * @syntax thin | medium | thick | \<length>
 * @see https://w3c.github.io/ttml2/#style-value-border-thickness
 */
const BorderThickness = as(
	"border-width",
	oneOf([
		//
		keyword("thin"),
		keyword("medium"),
		keyword("thick"),
		length(ScalarConstraint),
	]),
);

/**
 * @syntax \<border-color>
 * @see https://w3c.github.io/ttml2/#style-value-border-color
 */
const BorderColor = as("border-color", color());

/**
 * @syntax none | dotted | dashed | solid | double
 * @see https://w3c.github.io/ttml2/#style-value-border-style
 */
const BorderStyle = as(
	"border-style",
	oneOf([
		//
		keyword("none"),
		keyword("dotted"),
		keyword("dashed"),
		keyword("solid"),
		keyword("double"),
	]),
);

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
function BorderRadiiGrammar(): Derivable<"border-radii", string> {
	return Object.create(null, {
		type: {
			value: "<border-radii>",
		},
		derive: {
			value(token: string): DerivationResult {
				const parsing = validateBorderRadii(token);

				if (!parsing) {
					return {
						state: DerivationState.REJECTED,
					};
				}

				return {
					state: DerivationState.DONE,
					values: [parsing],
				};
			},
		},
	} satisfies { [K in keyof Derivable]: TypedPropertyDescriptor<Derivable[K]> });
}

const BorderRadii = as("border-radius", BorderRadiiGrammar());

/**
 * @syntax \<border-thickness> || \<border-style> || \<border-color> || \<border-radii>
 * @see https://w3c.github.io/ttml2/#style-value-border
 */
export const Grammar = someOf([
	//
	BorderThickness,
	BorderStyle,
	BorderColor,
	BorderRadii,
]);

export function cssTransform(
	_scope: Scope,
	values: InferDerivableValue<typeof Grammar>[],
): PropertiesCollection<["border-width", "border-style", "border-color", "border-radius"]> {
	const propertiesDictionary = values.reduce(
		(acc, curr) => {
			acc[curr.type] = isLength(curr.value) ? curr.value.toString() : curr.value;
			return acc;
		},
		{
			"border-color": "",
			"border-style": "",
			"border-width": "",
			"border-radius": "",
		} as { [K in InferDerivableValue<typeof Grammar>["type"]]: string },
	);

	return [
		["border-width", propertiesDictionary["border-width"]],
		["border-style", propertiesDictionary["border-style"]],
		["border-color", propertiesDictionary["border-color"]],
		["border-radius", propertiesDictionary["border-radius"]],
	];
}
