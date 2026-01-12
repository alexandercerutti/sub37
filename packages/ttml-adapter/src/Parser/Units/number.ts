export function asNumbers(values: string[]): number[] {
	return values.map((e) => parseFloat(e));
}

export function preventZero(value: number, fallback: number): number | null {
	if (value === 0) {
		return fallback;
	}

	return value;
}
