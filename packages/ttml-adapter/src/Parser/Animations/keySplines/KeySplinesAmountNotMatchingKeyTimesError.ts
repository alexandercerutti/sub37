export class KeySplinesAmountNotMatchingKeyTimesError extends Error {
	public constructor(splinesComponentAmount: number, keyTimesAmount: number) {
		super();

		this.name = "KeySplinesAmountNotMatchingKeyTimesError";
		this.message = `'keySplines' amount must be exactly one less than the keyTimes. Found ${splinesComponentAmount} splines components and ${keyTimesAmount} components`;
	}
}
