export function asNumbers(values: string[]): number[] {
	return values.map((e) => parseFloat(e));
}
