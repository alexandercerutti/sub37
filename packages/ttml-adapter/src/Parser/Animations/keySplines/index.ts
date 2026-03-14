import { getSplittedLinearWhitespaceValues } from "../../Units/lwsp";
import { KeySplinesAmountNotMatchingKeyTimesError } from "./KeySplinesAmountNotMatchingKeyTimesError";
import { KeySplinesCoordinateOutOfBoundaryError } from "./KeySplinesCoordinateOutOfBoundaryError";
import { KeySplinesInvalidControlsAmountError } from "./KeySplinesInvalidControlsAmountError";

/**
 * <key-splines>
 * @see https://w3c.github.io/ttml2/#animation-value-key-splines
 *
 * @param rawValue raw key-splines values from the attribute
 * @param keyTimes key times corresponding to the key splines
 * @returns an array of key spline coordinates, one per keyTime.
 */
export function getKeySplines(
	rawValue: string,
	keyTimes: number[],
): [x1: number, y1: number, x2: number, y2: number][] {
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
	const controlsList = rawValue.trim().split(/\s*;\s*/);
	const splines: [x1: number, y1: number, x2: number, y2: number][] = [];

	if (controlsList.length !== keyTimes.length - 1) {
		throw new KeySplinesAmountNotMatchingKeyTimesError(controlsList.length, keyTimes.length);
	}

	for (const control of controlsList) {
		const controlCoordinates = getSplittedLinearWhitespaceValues(control);
		const splineCoordinates: [x1: number, y1: number, x2: number, y2: number] = [0, 0, 0, 0];

		if (controlCoordinates.length !== 4) {
			throw new KeySplinesInvalidControlsAmountError(control);
		}

		for (let i = 0; i < controlCoordinates.length; i++) {
			const coordinateNumber = parseFloat(controlCoordinates[i]!);

			if (Number.isNaN(coordinateNumber) || coordinateNumber < 0 || coordinateNumber > 1) {
				throw new KeySplinesCoordinateOutOfBoundaryError(control, coordinateNumber);
			}

			splineCoordinates[i] = coordinateNumber;
		}

		splines.push(splineCoordinates);
	}

	return splines;
}
