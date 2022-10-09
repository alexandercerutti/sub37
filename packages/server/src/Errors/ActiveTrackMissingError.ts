/**
 * When Server will be instantiated without renderers, this will be the resulting error
 */

export class ActiveTrackMissingError extends Error {
	constructor() {
		super();

		const message = `
			No active track has been set. Cannot retrieve active cues.
		`;

		this.name = "ActiveTrackMissingError";
		this.message = message;
	}
}
