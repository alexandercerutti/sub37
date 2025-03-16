export class KeySplinesCoordinateOutOfBoundaryError extends Error {
	public constructor(control: string, coordinate: unknown) {
		super();

		this.name = "KeySplinesCoordinateOutOfBoundaryError";
		this.message = `Invalid spline: control '${control}' coordinate '${coordinate}' is invalid or exceeds the boundaries of [0, 1].`;
	}
}
