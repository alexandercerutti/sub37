export class KeySplinesNotAllowedError extends Error {
	public constructor() {
		super();

		this.name = "KeySplinesNotAllowedError";
		this.message =
			"'keySplines' attribute is allowed only when a continuous 'spline' animation is used. Animation got ignored";
	}
}
