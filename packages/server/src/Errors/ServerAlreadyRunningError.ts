export class ServerAlreadyRunningError extends Error {
	constructor() {
		super();

		const message = `Server is already running. Cannot perform operation.`;

		this.name = "ServerAlreadyRunningError";
		this.message = message;
	}
}
