export class KeyTimesAscendingOrderViolationError extends Error {
	public constructor(keyTime: number) {
		super();

		this.name = "KeyTimesAscendingOrderViolationError";
		this.message = `Invalid keyTimes: keyTime component '${keyTime}' is greater than the previous component. Ascending order is mandatory.`;
	}
}
