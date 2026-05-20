import type { PropertiesCollection } from "../../../parseStyle.js";
import type { Scope } from "../../../Scope/Scope.js";
import { createUnit } from "../../../Unit.js";
import type { Unit } from "../../../Unit.js";
import { readScopeDocumentContext } from "../../../Scope/DocumentContext.js";
import { readScopeErrorContext } from "../../../Scope/ErrorContext.js";
import type { InferDerivableValue } from "../structure/operators.js";
import type { PositionGrammar } from "../syntax/position.js";
import { normalizePositionValue } from "../syntax/position.js";
import { isPercentage } from "../primitives/length.js";
import type { Length } from "../primitives/length.js";
import { isPixelScalar, getPixelScalarPercentageConversion } from "../primitives/pixel.js";

export { PositionGrammar as Grammar } from "../syntax/position.js";

export function cssTransform(
	scope: Scope,
	value: InferDerivableValue<typeof PositionGrammar>,
): PropertiesCollection<["position", "left", "top"]> | null {
	const normalizedValue = normalizePositionValue(value);

	if (!normalizedValue) {
		return null;
	}

	const left = getPositionLengthDimension(scope, normalizedValue[1], 0);
	const top = getPositionLengthDimension(scope, normalizedValue[3], 1);

	return [
		["position", "absolute"],
		["left", left.toString()],
		["top", top.toString()],
	];
}

/**
 * Converts a normalized position length to a CSS-compatible unit.
 *
 * TTML px values require a declared document coordinate space (tts:extent
 * on <tt>) to be converted to CSS percentages. Without it, the px value
 * is passed through as-is — which is semantically incorrect (TTML px ≠
 * CSS px) but is the best available fallback.
 *
 * @TODO handle rw/rh (root container percentage units)
 * @TODO handle c (cell units — unusual in position context)
 * @TODO deferred-subtraction + px offsets produce calc(100% - Xpx),
 *       which is wrong when Xpx should have been converted to a percentage.
 */
function getPositionLengthDimension(scope: Scope, length: Length, axis: 0 | 1): Unit<string> {
	if (isPercentage(length)) {
		return length;
	}

	if (isPixelScalar(length)) {
		const documentExtent = readScopeDocumentContext(scope)?.attributes["tts:extent"];

		if (!documentExtent) {
			readScopeErrorContext(scope)?.report(
				new Error(
					`Position ${axis === 0 ? "left" : "top"} uses pixel units but no document extent is declared. Passing px through — result may be incorrect.`,
				),
				false,
			);

			return length;
		}

		return (
			getPixelScalarPercentageConversion(documentExtent[axis].value, length) ?? createUnit(0, "%")
		);
	}

	/* em passes through — CSS em semantics match TTML em */
	return length;
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof PositionGrammar>[],
	_animationType: "discrete" | "continuous",
): boolean {
	return true;
}
