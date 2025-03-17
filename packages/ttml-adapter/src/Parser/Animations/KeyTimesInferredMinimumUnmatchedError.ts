export class KeyTimesInferredMinimumUnmatchedError extends Error {
	public constructor() {
		super();

		this.name = "KeyTimesInferredMinimumUnmatchedError";
		this.message =
			"Invalid inferred keyTimes: at least two keyTimes are required for each component.";
	}
}
