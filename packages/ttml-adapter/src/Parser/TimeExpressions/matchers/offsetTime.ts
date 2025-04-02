import { AT_LEAST_ONE_DIGIT_TIME_REGEX } from "../../Units/time.js";
import type { Unit } from "../../Units/unit";
import { createUnit } from "../../Units/unit.js";

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

function createOffsetTimeUnit(match: RegExpMatchArray): OffsetTimeUnit {
	const [, timeCount, metric = "s"] = match;

	assertRecognizedMetric(metric);

	return createUnit(parseFloat(timeCount) || 0, metric);
}

function assertRecognizedMetric(metric: string): asserts metric is OffsetTimeUnit["metric"] {
	if (!["h", "m", "s", "ms", "f", "t"].includes(metric)) {
		throw new Error(
			`Metric not supported. Expected one of ["h" | "m" | "s" | "ms" | "f" | "t"], but received '${metric}'`,
		);
	}
}

export function matchOffsetTimeExpression(content: string): OffsetTimeUnit | null {
	let match: RegExpMatchArray | null = null;

	if (!(match = content.match(OFFSET_TIME_REGEX))) {
		return null;
	}

	return createOffsetTimeUnit(match);
}
