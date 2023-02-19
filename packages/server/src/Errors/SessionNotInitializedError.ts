export class SessionNotInitializedError extends Error {
	constructor() {
		super();

		const message = `No session initialized. Cannot start or perform other session operations.`;

		this.name = "SessionNotInitializedError";
		this.message = message;
	}
}
