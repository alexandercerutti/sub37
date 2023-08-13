export type OffsetTimeMatch = [unit: number, fraction: number, metric: string];

export function toOffsetTimeMatch(match: RegExpMatchArray): OffsetTimeMatch {
	const [, unit, fraction, metric] = match;

	return [parseInt(unit), parseInt(fraction), metric];
}
