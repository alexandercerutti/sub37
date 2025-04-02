import { createUnit, type Unit } from "./unit";

export function toClamped<Metric extends string | undefined>(
	unit: Unit<Metric> | null,
	min: number = -Infinity,
	max: number = Infinity,
): Unit<Metric> {
	if (unit === null) {
		return null;
	}

	if (typeof unit !== "object" || !("value" in unit) || !("metric" in unit)) {
		throw new Error(`Cannot clamp a value which is not a Unit. Received: '${unit}'`);
	}

	const clampedValue = Math.max(min, Math.min(unit.value, max));
	return createUnit(clampedValue, unit.metric);
}
