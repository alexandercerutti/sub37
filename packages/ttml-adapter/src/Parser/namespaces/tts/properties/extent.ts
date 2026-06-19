import type { Scope } from "../../../Scope/Scope.js";
import type { PropertiesCollection } from "../../../parseStyle.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { createUnit, toClamped } from "../../../Unit.js";
import { isLength, isPercentage } from "../primitives/length.js";
import type { Length } from "../primitives/length.js";
import { ExtentGrammar } from "../syntax/extent.js";
import { readScopeDocumentContext } from "../../../Scope/DocumentContext.js";
import { readScopeErrorContext } from "../../../Scope/ErrorContext.js";
import { getPixelScalarPercentageConversion, isPixelScalar } from "../primitives/pixel.js";
import { getCellScalarPercentageConversion, isCellScalar } from "../primitives/cell.js";
import { alias } from "../structure/derivables/alias.js";

export const Grammar = alias("tts:extent", ExtentGrammar);

function isExtentSupportedKeyword(
	value: InferDerivableValue<typeof ExtentGrammar>,
): value is Extract<InferDerivableValue<typeof ExtentGrammar>, [{ type: "keyword" }]> {
	return value.length === 1 && ["auto", "contain", "cover"].includes(value[0].value);
}

export function cssTransform(
	scope: Scope,
	value: InferDerivableValue<typeof ExtentGrammar>,
): PropertiesCollection<["width", "height"]> {
	if (isExtentSupportedKeyword(value)) {
		switch (value[0].value) {
			case "auto": {
				return [
					["width", "100%"],
					["height", "100%"],
				];
			}

			case "contain": {
				console.warn("Region extent 'contain' is not yet supported. Will be treated as 'auto'");
				return [
					["width", "100%"],
					["height", "100%"],
				];
			}

			case "cover": {
				console.warn("Region extent 'cover' is not yet supported. Will be treated as 'auto'");
				return [
					["width", "100%"],
					["height", "100%"],
				];
			}
		}
	}

	const widthLength = getExtentLengthDimension(scope, value[0], 0);
	const heightLength = getExtentLengthDimension(scope, value[1], 1);

	if (!widthLength || !heightLength) {
		return null;
	}

	return [
		["width", widthLength.toString()],
		["height", heightLength.toString()],
	];
}

/**
 * @param scope
 * @param data
 * @param axis - 0 for width, 1 for height
 * @returns
 */
function getExtentLengthDimension<
	ExtentData extends InferDerivableValue<typeof ExtentGrammar>[number],
>(scope: Scope, data: ExtentData, axis: 0 | 1): Length | null {
	if (!data) {
		return null;
	}

	const extentWithUnit = data.value;

	if (!isLength(extentWithUnit)) {
		console.warn(
			`Region extent ${axis === 0 ? "width" : "height"} set to a value different from a Length is not supported yet. Will be treated as 100%`,
		);

		return createUnit(100, "%");
	}

	if (isPercentage(extentWithUnit)) {
		return toClamped(extentWithUnit, 0, 100) || createUnit(0, "%");
	}

	const errorContext = readScopeErrorContext(scope)!;
	const documentContext = readScopeDocumentContext(scope)!;
	const documentExtent = documentContext.attributes["tts:extent"];

	if (isPixelScalar(extentWithUnit)) {
		if (!documentExtent) {
			errorContext.report(
				new Error(
					"Pixel values are deprecated for 'tts:extent' when document (<tt>) doesn't specify any 'tts:extent' pixel values. Will be treated as 100%.",
				),
				false,
			);

			return createUnit(100, "%");
		}

		return getPixelScalarPercentageConversion(documentExtent[axis].value, extentWithUnit);
	}

	if (isCellScalar(extentWithUnit)) {
		if (!documentExtent) {
			errorContext.report(
				new Error(
					`Region extent ${axis === 0 ? "width" : "height"} uses a cell unit, but document extent is not defined. Will be treated as 100%.`,
				),
				false,
			);

			return createUnit(100, "%");
		}

		const cellResolution = documentContext.attributes["ttp:cellResolution"];

		return (
			getCellScalarPercentageConversion(
				documentExtent[axis],
				cellResolution[axis],
				extentWithUnit,
			) ?? createUnit(100, "%")
		);
	}

	return extentWithUnit;
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof ExtentGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
