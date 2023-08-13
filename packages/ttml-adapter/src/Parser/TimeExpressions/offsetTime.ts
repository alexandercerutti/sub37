import { FRACTION_REGEX, TIME_COUNT_REGEX, TIME_METRIC_UNIT_REGEX } from "./TimeUnits.js";

/**
 * time-count fraction? metric
 */
const OFFSET_TIME_REGEX = new RegExp(
	`(${TIME_COUNT_REGEX.source}(?:${FRACTION_REGEX.source})?)(${TIME_METRIC_UNIT_REGEX.source})`,
);

export type OffsetTimeMatch = [unit: number, fraction: number, metric: string];

export function toOffsetTimeMatch(match: RegExpMatchArray): OffsetTimeMatch {
	const [, unit, fraction, metric] = match;

	return [parseInt(unit), parseInt(fraction), metric];
}
