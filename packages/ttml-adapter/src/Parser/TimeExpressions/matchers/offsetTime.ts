import { AT_LEAST_ONE_DIGIT_TIME_REGEX } from "../primitives.js";
import type { Unit } from "../../Unit.js";
import { createUnit } from "../../Unit.js";

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
	`(${TIME_COUNT_WITH_FRACTION_REGEX.source})(${TIME_METRIC_UNIT_REGEX.source})`,
);

export type OffsetTimeUnit = Unit<"h" | "m" | "s" | "ms" | "f" | "t">;
type MatchedOffsetTime = RegExpMatchArray & [unknown, string, OffsetTimeUnit["metric"] | undefined];

function createOffsetTimeUnit(match: MatchedOffsetTime): OffsetTimeUnit {
	const [, timeCount, metric = "s"] = match;

	assertRecognizedMetric(metric);

	return createUnit(parseFloat(timeCount) || 0, metric);
}

function assertRecognizedMetric(metric: string): asserts metric is OffsetTimeUnit["metric"] {
	if (!["h", "m", "s", "ms", "f", "t"].includes(metric)) {
		throw new UnsupportedOffsetTimeMetricError(metric);
	}
}

function matchedOffsetTimeExpression(match: RegExpMatchArray | null): match is MatchedOffsetTime {
	return match !== null;
}

export function matchOffsetTimeExpression(content: string): OffsetTimeUnit | null {
	const match = content.match(OFFSET_TIME_REGEX);

	if (!matchedOffsetTimeExpression(match)) {
		return null;
	}

	return createOffsetTimeUnit(match);
}

class UnsupportedOffsetTimeMetricError extends Error {
	constructor(metric: string) {
		super();

		this.name = "UnsupportedOffsetTimeMetricError";
		this.message = `The metric '${metric}' is not supported for offset time expressions. Supported metrics are: "h", "m", "s", "ms", "f", and "t".`;
	}
}
