export class KeyTimesLastValueNotOneError extends Error {
	public constructor() {
		super();

		this.name = "KeyTimesLastValueNotOneError";
		this.message = "Invalid keyTimes: last value is not 1.";
	}
}
