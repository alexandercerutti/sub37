export class KeyTimesInferredUnmatchedAnimationValueError extends Error {
	public constructor(
		styleProperty: string,
		actualAnimationValuesAmount: number,
		expectedAnimationAmount: number,
	) {
		super();

		this.name = "KeyTimesInferredUnmatchedAnimationValueError";
		this.message = `Invalid inferred keyTimes: ${styleProperty} has ${actualAnimationValuesAmount} <animation-value> while some have ${expectedAnimationAmount}. All the <animation-value-list> must have the same amount of <animation-value>.`;
	}
}
