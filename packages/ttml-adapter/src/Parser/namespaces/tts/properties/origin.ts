import { readScopeDocumentContext } from "../../../Scope/DocumentContext.js";
import { readScopeErrorContext } from "../../../Scope/ErrorContext.js";
import type { Scope } from "../../../Scope/Scope.js";
import { createUnit, Unit } from "../../../Unit.js";
import type { PropertiesCollection } from "../../../parseStyle.js";
import { isPercentage } from "../primitives/length.js";
import { getPixelScalarPercentageConversion, isPixelScalar } from "../primitives/pixel.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { OriginGrammar } from "../syntax/origin.js";

export const Grammar = alias("tts:origin", OriginGrammar);

export function cssTransform(
	scope: Scope,
	value: InferDerivableValue<typeof OriginGrammar>,
): PropertiesCollection<["x", "y"]> {
	if (value.length === 1) {
		/**
		 * @TODO might be wrong
		 *
		 * "If the value of this attribute is auto,
		 * then the computed value of the style
		 * property must be considered to be the
		 * same as the origin of the root container
		 * region."
		 *
		 * But we don't have this detail. So this should
		 * be calculated by the region it self in renderer?
		 */
		return [
			["x", "0px"],
			["y", "0px"],
		];
	}

	const xDimension = getOriginLengthDimension(scope, value[0], 0);
	const yDimension = getOriginLengthDimension(scope, value[1], 1);

	return [
		["x", xDimension.toString()],
		["y", yDimension.toString()],
	];
}

function getOriginLengthDimension(
	scope: Scope,
	data: Extract<InferDerivableValue<typeof OriginGrammar>[number], { type: "length" }>,
	axis: 0 | 1,
): Unit<"%"> {
	if (!data) {
		return createUnit(0, "%");
	}

	const originWithUnit = data.value;

	if (isPercentage(originWithUnit)) {
		return originWithUnit;
	}

	const errorContext = readScopeErrorContext(scope)!;

	if (isPixelScalar(originWithUnit)) {
		const documentContext = readScopeDocumentContext(scope)!;
		const documentExtent = documentContext.attributes["tts:extent"];

		if (!documentExtent) {
			errorContext.report(
				new Error(
					`Origin ${axis === 0 ? "x" : "y"} set to a pixel value, but document extent is not defined. Will be treated as 0px.`,
				),
				false,
			);

			return createUnit(0, "%");
		}

		return getPixelScalarPercentageConversion(documentExtent[axis].value, originWithUnit)!;
	}

	/**
	 * @TODO how to handle other length units here?
	 */

	errorContext.report(
		new Error(
			"Origin set to a Length different from px or %, is not supported yet. Will be treated as 0%.",
		),
		false,
	);

	return createUnit(0, "%");
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof OriginGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
