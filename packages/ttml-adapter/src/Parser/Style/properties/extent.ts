import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { createUnit } from "../../Units/unit.js";
import { isLength } from "../../Units/length.js";
import type { Length } from "../../Units/length.js";
import { toClamped } from "../../Units/clamp.js";
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

	let [{ value: width }, { value: height }] = value;
	let widthLength: Length;
	let heightLength: Length;

	if (isLength(width)) {
		widthLength = toClamped(width, 0, 100) || createUnit(0, "%");
	} else {
		if (
			width === "auto" ||
			width === "fitContent" ||
			width === "maxContent" ||
			width === "minContent"
		) {
			console.warn(
				"Region extent width set to a value different from a Length is not yet supported. Will be treated as 100%",
			);

			width = createUnit(100, "%");
		}

		widthLength = width;
	}

	if (isLength(height)) {
		heightLength = toClamped(height, 0, 100) || createUnit(0, "%");
	} else {
		if (
			height === "auto" ||
			height === "fitContent" ||
			height === "maxContent" ||
			height === "minContent"
		) {
			console.warn(
				"Region extent height set to a value different from a Length is not yet supported. Will be treated as 100%",
			);

			height = createUnit(100, "%");
		}

		heightLength = height;
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
