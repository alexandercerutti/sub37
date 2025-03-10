export class KeyTimesPacedNotAllowedError extends Error {
	public constructor() {
		super();

		this.name = "KeyTimesPacedNotAllowedError";
		this.message =
			"'keyTimes' attribute usage for a 'paced' animation is forbidden. Animation got ignored.";
	}
}
