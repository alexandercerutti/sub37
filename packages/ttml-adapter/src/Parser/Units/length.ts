/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#style-value-length
 */

const UNIT_MEASURE_NUMBER_REGEX = /((-|\+)?\d+(?:\.\d+)?)([a-zA-Z%]+)$/;

const ALLOWED_SCALAR_UNITS = ["px", "em", "c", "rw", "rh"] as const;
type ALLOWED_SCALAR_UNITS = typeof ALLOWED_SCALAR_UNITS;

export interface Scalar {
	value: number;
	unit: ALLOWED_SCALAR_UNITS[number];
}

export interface Percentage {
	value: number;
	unit: "%";
}

function isScalarUnit(unit: string): unit is Scalar["unit"] {
	return ALLOWED_SCALAR_UNITS.includes(unit as Scalar["unit"]);
}

export function isScalar(maybeScalar: unknown): maybeScalar is Scalar {
	return (
		maybeScalar && typeof maybeScalar === "object" && isScalarUnit((maybeScalar as Scalar).unit)
	);
}

function isPercentageUnit(unit: string): unit is "%" {
	return unit === "%";
}

export function getParsedLength(value: string): Scalar | Percentage | null {
	if (!value) {
		return null;
	}

	const match = value.match(UNIT_MEASURE_NUMBER_REGEX);

	if (!match?.length || !(isPercentageUnit(match[2]) || isScalarUnit(match[2]))) {
		return null;
	}

	return {
		value: parseFloat(match[1]),
		unit: match[2],
	};
}
