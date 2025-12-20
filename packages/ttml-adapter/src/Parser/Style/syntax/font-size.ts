import type { Scope } from "../../Scope/Scope";
import type { PropertiesCollection } from "../../parseStyle";
import type { Length } from "../../Units/length";
import { readScopeDocumentContext } from "../../Scope/DocumentContext";
import { getCellScalarPixelConversion, isCellScalar } from "../../Units/cell";
import { createUnit } from "../../Units/unit";
import { alias } from "../structure/derivables/alias";
import { length, NonNegativeConstraint } from "../structure/derivables/length";
import { sequence, zeroOrOne } from "../structure/operators";

/**
 * @syntax \<font-size>
 *  : \<length> (\<lwsp> \<length>)?
 * @see https://w3c.github.io/ttml2/#style-value-font-size
 */
export const Grammar = alias(
	"<font-size>",
	sequence([
		// When only one length specified, the first length
		// is the size for both horizontal and vertical for a glyph
		// Otherwise only the horizontal size.
		length(NonNegativeConstraint),
		zeroOrOne(
			// Vertical size of a glyph
			length(NonNegativeConstraint),
		),
	]),
);

type RemappedValues = [Length, Length?];

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
	value: RemappedValues,
): PropertiesCollection<["font-size"]> {
	const {
		attributes: {
			"ttp:cellResolution": [, cellResolutionHeight],
			"tts:extent": [exHeight],
		},
	} = readScopeDocumentContext(scope);

	/**
	 * @TODO how to handle default value here?
	 */
	// if (!splittedValue.length) {
	// 	return fontSizeValueDefaultLength(exHeight, cellResolutionHeight).toString();
	// }

	if (value.length >= 2) {
		const [horizonalGlyphSizeParsed, verticalGlyphSizeParsed] = value;

		if (horizonalGlyphSizeParsed.metric !== verticalGlyphSizeParsed.metric) {
			return [["font-size", fontSizeValueDefaultLength(exHeight, cellResolutionHeight).toString()]];
		}
	}

	const [fontSize] = value;

	if (isCellScalar(fontSize)) {
		const {
			attributes: {
				"ttp:cellResolution": [, cellResolutionHeight],
				"tts:extent": [exHeight],
			},
		} = readScopeDocumentContext(scope);

		return [
			[
				"font-size",
				createUnit(
					getCellScalarPixelConversion(exHeight, cellResolutionHeight, fontSize),
					"px",
				).toString(),
			],
		];
	}

	/**
	 * @TODO handle "rw" and "rh"
	 */

	return [["font-size", fontSize.toString()]];
}

function fontSizeValueDefaultLength(dimension: number, cellResolutionDimension: number): Length {
	// Initial value is 1c
	return createUnit(
		getCellScalarPixelConversion(dimension, cellResolutionDimension, createUnit(1, "c")),
		"px",
	);
}
