/**
 * @TODO this error is replicated also inside TTML adapter
 * but moving this on Server requires a breaking change
 * because it would require adapters to have a specific version
 * of server.
 */

export class MissingContentError extends Error {
	constructor() {
		super();
		this.name = "MissingContentError";
		this.message = "Cannot parse content. Empty content received.";
	}
}
