/**
 * Base Unit for all the other usages
 */

export interface Unit<Metric extends string> {
	value: number;
	metric: Metric;
	toString(): string;
}

export function createUnit<Metric extends string>(value: number, metric: Metric): Unit<Metric> {
	if (!metric) {
		throw new Error("Cannot create a length representation without a specified unit");
	}

	return {
		value,
		metric,
		toString(): string {
			return `${this.value}${this.metric}`;
		},
	};
}
