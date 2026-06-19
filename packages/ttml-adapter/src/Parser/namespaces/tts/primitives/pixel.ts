/**
 * TTML Pixels are not CSS Pixels.
 *
 * §10.3.22:
 * > The unit px (pixel) corresponds to a logical pixel of
 * > the document coordinate space, as defined by H.3 Coordinate Space;
 *
 * @see https://w3c.github.io/ttml2/#root-container-region-semantics-coordinate-space
 * @see https://w3c.github.io/ttml2/#style-value-length
 */

import { createUnit } from "../../../Unit.js";
import type { Unit } from "../../../Unit.js";
import { isScalar } from "./length.js";
import type { Length } from "./length.js";

export type PixelScalar = Length & { metric: "px" };

export function isPixelScalar(value: unknown): value is PixelScalar {
	return isScalar(value) && value.metric === "px";
}

export function getPixelScalarPercentageConversion(
	referenceValue: number,
	pixelValue: PixelScalar,
): Unit<"%"> | null {
	if (!isPixelScalar(pixelValue)) {
		return null;
	}

	return createUnit((pixelValue.value / referenceValue) * 100, "%");
}
