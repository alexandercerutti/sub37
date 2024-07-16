import { FRACTION_REGEX, TIME_COUNT_REGEX, TIME_METRIC_UNIT_REGEX } from "../../Units/time.js";

/**
 * time-count fraction? metric
 */
const OFFSET_TIME_REGEX = new RegExp(
	`(${TIME_COUNT_REGEX.source}(?:${FRACTION_REGEX.source})?)(${TIME_METRIC_UNIT_REGEX.source})`,
);

export type OffsetTimeMatch = [unit: number, fraction: number, metric: string];

function toOffsetTimeMatch(match: RegExpMatchArray): OffsetTimeMatch {
	const [, unit, fraction, metric] = match;

	return [parseInt(unit), parseFloat(`0.${fraction}`) || 0, metric];
}

export function matchOffsetTimeExpression(content: string): OffsetTimeMatch | null {
	let match: RegExpMatchArray | null = null;

	if (!(match = content.match(OFFSET_TIME_REGEX))) {
		return null;
	}

	return toOffsetTimeMatch(match);
}
