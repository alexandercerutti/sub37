export class KeyTimesComponentOutOfBoundaryError extends Error {
	public constructor(keyTime: number) {
		super();

		this.name = "KeyTimesComponentOutOfBoundaryError";
		this.message = `Invalid keyTimes: keyTime component '${keyTime}' exceeds the boundary of [0, 1]. Animation ignored.`;
	}
}
