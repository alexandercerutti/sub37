export function asNumbers(values: string[]): number[] {
	return values.map((e) => parseFloat(e));
}

export function preventZero(value: number, fallback: number): number | null {
	if (value === 0) {
		return fallback;
	}

	return value;
}

/**
 * @param values
 * @param fallbacks an array with a fallback to be used if a zero is found
 * 									at a specific index of _values_
 * @returns
 */

export function preventZeros(values: number[], fallbacks: number[]): number[] {
	return values.map((element, index) => preventZero(element, fallbacks[index]));
}
