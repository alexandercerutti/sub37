/**
 * When Server will be instantiated without adapters, this will be the resulting error
 */

export class NoAdaptersFoundError extends Error {
	constructor() {
		super();

		const message = `Server didn't find any valid adapter.

	If you are a adapter developer, please ensure yourself that your adapter satisfies all the API requirements. See documentation for more details.
		`;

		this.name = "NoAdaptersFoundError";
		this.message = message;
	}
}
