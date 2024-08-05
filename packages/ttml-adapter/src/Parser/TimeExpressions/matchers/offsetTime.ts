import { AT_LEAST_ONE_DIGIT_TIME_REGEX } from "../../Units/time.js";

/**
 * hours | minutes | seconds | milliseconds | frames | ticks
 */
const TIME_METRIC_UNIT_REGEX = /h|m|s|ms|f|t/;

const TIME_COUNT_WITH_FRACTION_REGEX = new RegExp(
	`${AT_LEAST_ONE_DIGIT_TIME_REGEX.source}(?:\.${AT_LEAST_ONE_DIGIT_TIME_REGEX.source})?`,
);

/**
 * || time-count || fraction?    || metric
 * || <digit>+   || "." <digit>+ || "h" | "m" | "s" | "ms" | "f" | "t"
 */
const OFFSET_TIME_REGEX = new RegExp(
	`(${TIME_COUNT_WITH_FRACTION_REGEX.source}(${TIME_METRIC_UNIT_REGEX.source})`,
);

export type OffsetTimeMatch = [timeCount: number, metric: "h" | "m" | "s" | "ms" | "f" | "t"];

function toOffsetTimeMatch(match: RegExpMatchArray): OffsetTimeMatch {
	const [, timeCount, metric = "s"] = match;

	assertRecognizedMetric(metric);

	return [parseFloat(timeCount) || 0, metric];
}

/**
 * @TODO This should be moved to units, in time units. Units format should be
 * uniformed in the whole project
 */

function assertRecognizedMetric(
	metric: string,
): asserts metric is "h" | "m" | "s" | "ms" | "f" | "t" {
	if (["h", "m", "s", "ms", "f", "t"].includes(metric)) {
		throw new Error(
			`Metric not supported. Expected one of ["h" | "m" | "s" | "ms" | "f" | "t"], but received '${metric}'`,
		);
	}
}

export function matchOffsetTimeExpression(content: string): OffsetTimeMatch | null {
	let match: RegExpMatchArray | null = null;

	if (!(match = content.match(OFFSET_TIME_REGEX))) {
		return null;
	}

	return toOffsetTimeMatch(match);
}
