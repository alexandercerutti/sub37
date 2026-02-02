import { getSplittedLinearWhitespaceValues } from "../../Units/lwsp";
import { KeySplinesAmountNotMatchingKeyTimesError } from "./KeySplinesAmountNotMatchingKeyTimesError";
import { KeySplinesCoordinateOutOfBoundaryError } from "./KeySplinesCoordinateOutOfBoundaryError";
import { KeySplinesInvalidControlsAmountError } from "./KeySplinesInvalidControlsAmountError";

/**
 * <key-splines>
 * @see https://w3c.github.io/ttml2/#animation-value-key-splines
 *
 * @param value
 * @param keyTimes
 * @returns
 */
export function getKeySplines(value: string, keyTimes: number[]): number[][] {
	/**
	 * @syntax
	 *
	 * ```
	 * <key-splines>
	 * : control ( <lwsp>? ";" <lwsp>? control )*
	 *
	 *	control
	 *: x1 <lwsp> y1 <lwsp> x2 <lwsp> y2
	 * ```
	 */
	const splineControls = value.trim().split(/\s?;\s*/);
	const splines: number[][] = [];

	if (splineControls.length !== keyTimes.length - 1) {
		throw new KeySplinesAmountNotMatchingKeyTimesError(splineControls.length, keyTimes.length);
	}

	for (const control of splineControls) {
		const coordinates = getSplittedLinearWhitespaceValues(control);
		const splineCoordinates: number[] = [];

		if (coordinates.length !== 4) {
			throw new KeySplinesInvalidControlsAmountError(control);
		}

		for (const coordinate of coordinates) {
			const coordinateNumber = parseFloat(coordinate);

			if (Number.isNaN(coordinateNumber) || coordinateNumber < 0 || coordinateNumber > 1) {
				throw new KeySplinesCoordinateOutOfBoundaryError(control, coordinateNumber);
			}

			splineCoordinates.push(coordinateNumber);
		}

		splines.push(splineCoordinates);
	}

	return splines;
}
