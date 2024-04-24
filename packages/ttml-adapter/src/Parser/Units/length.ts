/**
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#style-value-length
 */

const UNIT_MEASURE_NUMBER_REGEX = /((-|\+)?\d+(?:\.\d+)?)([a-zA-Z%]+)$/;

const ALLOWED_SCALAR_UNITS = ["px", "em", "c", "rw", "rh"] as const;
type ALLOWED_SCALAR_UNITS = typeof ALLOWED_SCALAR_UNITS;

interface Scalar {
	value: number;
	unit: ALLOWED_SCALAR_UNITS[number];
	toString(): string;
}

interface Percentage {
	value: number;
	unit: "%";
	toString(): string;
}

export type Length = Scalar | Percentage;

function isScalarUnit(unit: string): unit is Scalar["unit"] {
	return ALLOWED_SCALAR_UNITS.includes(unit as Scalar["unit"]);
}

export function isLength(maybeLength: unknown): maybeLength is Length {
	return (
		Boolean(maybeLength) &&
		typeof (maybeLength as Length).unit !== "undefined" &&
		typeof (maybeLength as Length).value === "number"
	);
}

export function isScalar(maybeScalar: unknown): maybeScalar is Scalar {
	return isLength(maybeScalar) && isScalarUnit((maybeScalar as Scalar).unit);
}

export function isPercentage(maybeScalar: unknown): maybeScalar is Percentage {
	return isLength(maybeScalar) && isPercentageUnit((maybeScalar as Percentage).unit);
}

function isPercentageUnit(unit: string): unit is "%" {
	return unit === "%";
}

export function toLength(value: string): Scalar | Percentage | null {
	if (!value) {
		return null;
	}

	const match = value.match(UNIT_MEASURE_NUMBER_REGEX);

	if (!match?.length || !(isPercentageUnit(match[2]) || isScalarUnit(match[2]))) {
		return null;
	}

	return createLength(parseFloat(match[1]), match[2]);
}

export function createLength(value: number, unit: Length["unit"]): Length {
	if (!unit) {
		throw new Error("Cannot create a length representation without a specified unit");
	}

	return {
		value,
		unit,
		toString(): string {
			return `${this.value}${this.unit}`;
		},
	};
}
