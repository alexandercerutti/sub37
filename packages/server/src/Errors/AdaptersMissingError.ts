/**
 * When Server will be instantiated without adapters, this will be the resulting error
 */

export class AdaptersMissingError extends Error {
	constructor() {
		super("HSServer is expected to be initialized with adapters. Received none.");
		this.name = "AdaptersMissingError";
	}
}
