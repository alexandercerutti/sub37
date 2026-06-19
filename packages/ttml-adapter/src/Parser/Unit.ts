/**
 * Base Unit for all the other usages
 */

export interface Unit<Metric extends string | undefined> {
	value: number;
	metric: Metric;
	toString(): string;
}

export function createUnit<Metric extends string>(value: number, metric: Metric): Unit<Metric> {
	return {
		value,
		metric,
		toString(): string {
			return `${this.value}${this.metric}`;
		},
	};
}

export function toClamped<Metric extends string>(
	unit: Unit<Metric> | null,
	min: number = -Infinity,
	max: number = Infinity,
): Unit<Metric> | null {
	if (unit === null) {
		return null;
	}

	if (typeof unit !== "object" || !("value" in unit) || !("metric" in unit)) {
		throw new Error(`Cannot clamp a value which is not a Unit. Received: '${unit}'`);
	}

	const clampedValue = Math.max(min, Math.min(unit.value, max));
	return createUnit(clampedValue, unit.metric);
}
