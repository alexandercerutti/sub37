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
