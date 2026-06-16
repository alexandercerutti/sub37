export class MissingContentError extends Error {
	constructor() {
		super();
		this.name = "MissingContentError";
		this.message = "Cannot parse content. Empty content received.";
	}
}
