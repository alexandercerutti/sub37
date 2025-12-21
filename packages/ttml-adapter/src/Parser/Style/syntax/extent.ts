import type { Scope } from "../../Scope/Scope.js";
import type { PropertiesCollection } from "../../parseStyle.js";
import type { Length } from "../../Units/length.js";
import * as Measure from "./measure.js";
import { oneOf, sequence } from "../structure/operators.js";
import type { InferDerivableValue } from "../structure/operators.js";
import { keyword } from "../structure/derivables/keyword.js";
import { alias } from "../structure/derivables/alias.js";
import { isLength } from "../../Units/length.js";
import { toClamped } from "../../Units/clamp.js";
import { createUnit } from "../../Units/unit.js";

/**
 * @syntax \<extent>
 *  : "auto"
 *  | "contain"
 *  | "cover"
 *  | \<measure> \<lwsp> \<measure>
 *
 * @see https://w3c.github.io/ttml2/#style-value-extent
 */
export const Grammar = alias(
	"<extent>",
	oneOf([
		keyword("auto"),
		keyword("contain"),
		keyword("cover"),
		sequence([
			//
			Measure.Grammar,
			Measure.Grammar,
		]),
	]),
);

function isExtentSupportedKeyword(
	value: InferDerivableValue<typeof Grammar>,
): value is "auto" | "contain" | "cover" {
	return ["auto", "contain", "cover"].includes(value as string);
}

export function cssTransform(
	_scope: Scope,
	value: InferDerivableValue<typeof Grammar>,
): PropertiesCollection<["width", "height"]> {
	if (isExtentSupportedKeyword(value)) {
		switch (value) {
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

	let [width, height] = value;
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
	}

	return [
		["width", widthLength.toString()],
		["height", heightLength.toString()],
	];
}
