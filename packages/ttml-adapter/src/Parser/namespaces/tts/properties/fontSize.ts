import type { Scope } from "../../../Scope/Scope.js";
import type { PropertiesCollection } from "../../../parseStyle.js";
import { alias } from "../structure/derivables/alias.js";
import type { InferDerivableValue } from "../../../structure/grammar.js";
import { FontSizeGrammar } from "../syntax/font-size.js";
import type { Length } from "../primitives/length.js";
import { readScopeDocumentContext } from "../../../Scope/DocumentContext.js";
import { getCellScalarPixelConversion, isCellScalar } from "../primitives/cell.js";
import { createUnit } from "../../../Unit.js";
import type { PixelScalar } from "../primitives/pixel.js";

export const Grammar = alias("tts:fontSize", FontSizeGrammar);

/**
 * TTML supports providing two <length> for `tts:fontSize`.
 * However, CSS supports only one dimension, the vertical one.
 *
 * To achieve the horizontal one, we are required to use
 * `transform: scale(x, y)`, with the appropriate scaling factors,
 * and create an element that should be putted to `display: inline-block`.
 *
 * Therefore, we should calculate the factor (how?) and change introduce
 * some style resetter or isolation in the renderer in order to achieve
 * such style.
 *
 * This element should probably wrap the whole subtitles elements.
 *
 * Not exactly the moment. Sorry folks.
 *
 * @param scope
 * @param value
 * @returns
 */

export function cssTransform(
	scope: Scope,
	value: InferDerivableValue<typeof FontSizeGrammar>,
): PropertiesCollection<["font-size"]> | null {
	const documentContext = readScopeDocumentContext(scope);

	if (!documentContext) {
		return null;
	}

	const {
		attributes: {
			"ttp:cellResolution": [, cellResolutionHeight],
			"tts:extent": extent,
		},
	} = documentContext;

	if (value[1]) {
		const [{ value: horizonalGlyphSizeParsed }, { value: verticalGlyphSizeParsed }] = value;

		if (horizonalGlyphSizeParsed.metric !== verticalGlyphSizeParsed.metric) {
			if (typeof extent?.[1] === "undefined" || !cellResolutionHeight) {
				return null;
			}

			return [
				["font-size", fontSizeValueDefaultLength(extent[1], cellResolutionHeight).toString()],
			];
		}
	}

	const [{ value: fontSize }] = value;

	if (isCellScalar(fontSize)) {
		if (typeof extent?.[1] === "undefined" || !cellResolutionHeight) {
			return null;
		}

		const convertedPixelUnit = getCellScalarPixelConversion(
			extent[1],
			cellResolutionHeight,
			fontSize,
		);

		if (!convertedPixelUnit) {
			return null;
		}

		return [["font-size", convertedPixelUnit.toString()]];
	}

	/**
	 * @TODO handle "rw" and "rh"
	 */

	return [["font-size", fontSize.toString()]];
}

function fontSizeValueDefaultLength(
	dimension: PixelScalar,
	cellResolutionDimension: number,
): Length {
	// Initial value is 1c
	return getCellScalarPixelConversion(dimension, cellResolutionDimension, createUnit(1, "c"))!;
}

export function validateAnimation(
	_keyframes: InferDerivableValue<typeof FontSizeGrammar>[],
	animationType: "discrete" | "continuous",
): boolean {
	return animationType === "discrete";
}
