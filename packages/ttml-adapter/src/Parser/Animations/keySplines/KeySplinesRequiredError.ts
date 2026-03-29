export class KeySplinesRequiredError extends Error {
	public constructor() {
		super();

		this.name = "KeySplinesRequiredError";
		this.message =
			"'keySpline' attribute is required when a spline animation is used. Animation got ignored";
	}
}
