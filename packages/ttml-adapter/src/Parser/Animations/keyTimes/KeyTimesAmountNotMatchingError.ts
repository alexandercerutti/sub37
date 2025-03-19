export class KeyTimesAmountNotMatchingError extends Error {
	public constructor(keyTimesAmount: number, styleProperty: string) {
		super();

		this.name = "KeyTimesAmountNotMatchingError";
		this.message = `Invalid KeyTimes: the amount of keytimes (${keyTimesAmount}) is different from the amount of <animation-value> for style '${styleProperty}'. Ignoring animation.`;
	}
}
