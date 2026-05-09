import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { createUnit, toClamped } from "../../Unit.js";
import { isLength, isPercentage } from "../primitives/length.js";
import type { Length } from "../primitives/length.js";
import type { ExtentGrammar } from "../syntax/extent.js";

export { ExtentGrammar as Grammar } from "../syntax/extent.js";

function isExtentSupportedKeyword(
	value: InferDerivableValue<typeof ExtentGrammar>,
): value is Extract<InferDerivableValue<typeof ExtentGrammar>, [{ type: "keyword" }]> {
	return value.length === 1 && ["auto", "contain", "cover"].includes(value[0].value);
}

export function cssTransform(
	_scope: Scope,
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

	let [widthValue, heightValue] = value;
	let widthLength: Length;
	let heightLength: Length;

	if (widthValue && isLength(widthValue.value)) {
		if (isPercentage(widthValue.value)) {
			widthLength = toClamped(widthValue.value, 0, 100) || createUnit(0, "%");
		} else {
			widthLength = widthValue.value;
		}
	} else {
		console.warn(
			"Region extent width set to a value different from a Length is not yet supported. Will be treated as 100%",
		);

		widthLength = createUnit(100, "%");
	}

	if (heightValue && isLength(heightValue.value)) {
		if (isPercentage(heightValue.value)) {
			heightLength = toClamped(heightValue.value, 0, 100) || createUnit(0, "%");
		} else {
			heightLength = heightValue.value;
		}
	} else {
		console.warn(
			"Region extent height set to a value different from a Length is not yet supported. Will be treated as 100%",
		);

		heightLength = createUnit(100, "%");
	}

	return [
		["width", widthLength.toString()],
		["height", heightLength.toString()],
	];
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof ExtentGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
