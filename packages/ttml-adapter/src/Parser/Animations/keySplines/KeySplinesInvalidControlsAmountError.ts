export class KeySplinesInvalidControlsAmountError extends Error {
	public constructor(control: string) {
		super();

		this.name = "KeySplinesInvalidControlsAmountError";
		this.message = `Invalid spline: control '${control}' failed because it doesn't have the 4 required coordinates.`;
	}
}
