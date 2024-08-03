import { FRACTION_REGEX, TIME_COUNT_REGEX, TIME_METRIC_UNIT_REGEX } from "../../Units/time.js";

/**
 * || time-count || fraction?    || metric
 * || <digit>+   || "." <digit>+ || "h" | "m" | "s" | "ms" | "f" | "t"
 */
const OFFSET_TIME_REGEX = new RegExp(
	`(${TIME_COUNT_REGEX.source}(?:${FRACTION_REGEX.source})?)(${TIME_METRIC_UNIT_REGEX.source})`,
);

export type OffsetTimeMatch = [timeCount: number, fraction: number, metric: string];

function toOffsetTimeMatch(match: RegExpMatchArray): OffsetTimeMatch {
	const [, timeCount, fraction, metric] = match;

	return [parseInt(timeCount) || 0, parseFloat(`.${fraction}`) || 0, metric || "s"];
}

export function matchOffsetTimeExpression(content: string): OffsetTimeMatch | null {
	let match: RegExpMatchArray | null = null;

	if (!(match = content.match(OFFSET_TIME_REGEX))) {
		return null;
	}

	return toOffsetTimeMatch(match);
}
