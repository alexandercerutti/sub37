/**
 * Converters for 'cell' unit (i.e. 0.1c)
 */

import type { Length } from "./length.js";
import { isScalar } from "./length.js";

type CellScalar = Length & { unit: "c" };

/**
 * @example
 *
 * For example, if padding (on all four edges) is specified
 * as 0.1c, the cell resolution is `20` by `10`, and the extent
 * of the root container region is `640` by `480`, then,
 * assuming top to bottom, left to right writing mode, the
 * start and end padding will be
 *
 * ```
 * (640 / 20) * 0.1 pixels
 * ```
 *
 * and the before and after padding will be
 *
 * ```
 * (480 / 10) * 0.1 pixels.
 * ```
 *
 * @param length The value to be converted
 * @param cellProgressionResolution the cell size for the specific direction (a.k.a. progression)
 * @param cellScalar the cell scalar to be used for conversion (e.g. the multiplier)
 * @returns
 */

export function getCellScalarPixelConversion(
	length: number,
	cellProgressionResolution: number,
	cellScalar: Length,
): number | null {
	if (!isCellScalar(cellScalar)) {
		return null;
	}

	return (length / cellProgressionResolution) * cellScalar.value;
}

export function isCellScalar(value: unknown): value is CellScalar {
	return isScalar(value) && value.unit === "c";
}
