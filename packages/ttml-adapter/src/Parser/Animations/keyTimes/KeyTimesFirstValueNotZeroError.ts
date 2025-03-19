export class KeyTimesFirstValueNotZeroError extends Error {
	public constructor() {
		super();

		this.name = "KeyTimesFirstValueNotZeroError";
		this.message = "Invalid keyTimes: first value is not 0.";
	}
}
