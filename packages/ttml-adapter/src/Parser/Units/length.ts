import type { Unit } from "./unit";
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

function isScalarUnit(metric: string): metric is Scalar["metric"] {
	return ALLOWED_SCALAR_UNITS.includes(metric as Scalar["metric"]);
}

export function isLength(maybeLength: unknown): maybeLength is Length {
	return (
		Boolean(maybeLength) &&
		typeof (maybeLength as Length).metric !== "undefined" &&
		typeof (maybeLength as Length).value === "number"
	);
}

export function isScalar(maybeScalar: unknown): maybeScalar is Scalar {
	return isLength(maybeScalar) && isScalarUnit((maybeScalar as Scalar).metric);
}

export function isPercentage(maybeScalar: unknown): maybeScalar is Percentage {
	return isLength(maybeScalar) && isPercentageUnit((maybeScalar as Percentage).metric);
}

function isPercentageUnit(metric: string): metric is "%" {
	return metric === "%";
}

export function toLength(value: string): Scalar | Percentage | null {
	if (!value) {
		return null;
	}

	const match = value.match(UNIT_MEASURE_NUMBER_REGEX);

	if (!match?.length || !(isPercentageUnit(match[2]) || isScalarUnit(match[2]))) {
		return null;
	}

	return createUnit(parseFloat(match[1]), match[2]);
}
