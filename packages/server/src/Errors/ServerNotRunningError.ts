export class ServerNotRunningError extends Error {
	constructor() {
		super();

		const message = `Server has been started but is not running. Cannot perform operation.`;

		this.name = "ServerNotRunningError";
		this.message = message;
	}
}
