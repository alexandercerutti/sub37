/**
 * When Server will be instantiated without renderers, this will be the resulting error
 */

export class RenderersMissingError extends Error {
	constructor() {
		super("HSServer is expected to be initialized with renderers. Received none.");
		this.name = "RenderersMissingError";
	}
}
