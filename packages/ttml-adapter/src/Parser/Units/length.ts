import type { Unit } from "./unit.js";
import { createUnit } from "./unit.js";

/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#style-value-length
 */

const UNIT_MEASURE_NUMBER_REGEX = /((?:-|\+)?\d+(?:\.\d+)?)([a-zA-Z%]+)$/;

const ALLOWED_SCALAR_UNITS = ["px", "em", "c", "rw", "rh"] as const;
type ALLOWED_SCALAR_UNITS = typeof ALLOWED_SCALAR_UNITS;

type Scalar = Unit<ALLOWED_SCALAR_UNITS[number]>;
type Percentage = Unit<"%">;

export type Length = Scalar | Percentage;

export function isLength(maybeLength: unknown): maybeLength is Length {
	return (
		Boolean(maybeLength) &&
		typeof (maybeLength as Length).metric !== "undefined" &&
		typeof (maybeLength as Length).value === "number"
	);
}

export function isScalar(maybeScalar: unknown): maybeScalar is Scalar {
	return isLength(maybeScalar) && isScalarUnit(maybeScalar.metric);
}

function isScalarUnit(metric: string): metric is Scalar["metric"] {
	return ALLOWED_SCALAR_UNITS.includes(metric as Scalar["metric"]);
}

export function isPercentage(maybeScalar: unknown): maybeScalar is Percentage {
	return isLength(maybeScalar) && isPercentageUnit(maybeScalar.metric);
}

function isPercentageUnit(metric: string): metric is "%" {
	return metric === "%";
}

export function toLength(value: string): Length | null {
	if (!value) {
		return null;
	}

	const match = value.match(UNIT_MEASURE_NUMBER_REGEX);

	if (!match?.length) {
		return null;
	}

	if (!match[2]) {
		throw new Error("Cannot create a length representation without a specified unit");
	}

	if (!(isPercentageUnit(match[2]) || isScalarUnit(match[2]))) {
		return null;
	}

	return createUnit(parseFloat(match[1]), match[2]);
}

type DeferredLengthSubtraction = Unit<"deferred-subtraction">;

/**
 * This function returns a Length representing the subtraction of two lengths.
 *
 * This is needed because we are currently converting to CSS but when the
 * length metrics are different, we cannot perform the subtraction directly,
 * as we need to convert them first. Browser will handle them at this point in time.
 *
 * Later, we might create a deferred length on engine level so that the renderer
 * can handle such cases with - perhaps - other platforms.
 */
export function toDeferredLengthSubtraction(
	value1: Length,
	value2: Length,
): DeferredLengthSubtraction {
	return {
		metric: "deferred-subtraction",
		value: NaN,
		toString() {
			return `calc(${value1.toString()} - ${value2.toString()})`;
		},
	};
}

/**
 * Subtracts two lengths with the same unit
 *
 * @param a
 * @param b
 * @returns
 */
export function subtract<L extends Length | DeferredLengthSubtraction>(a: L, b: L): L | null {
	if (!isLength(a) || !isLength(b)) {
		return null;
	}

	if (a.metric !== b.metric) {
		return toDeferredLengthSubtraction(a, b) as L;
	}

	return createUnit(a.value - b.value, a.metric) as L;
}
