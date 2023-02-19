export class SessionNotStartedError extends Error {
	constructor() {
		super();

		const message = `Session has been created but not been started yet. Cannot perform any operation.`;

		this.name = "SessionNotStartedError";
		this.message = message;
	}
}
