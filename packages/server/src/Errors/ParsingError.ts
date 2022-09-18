export class ParsingError extends Error {
	constructor(originalError: unknown) {
		super();

		const message = `Unable to create parsing session: critical issues prevented content parsing. More details below.
		${originalError}
		`;

		this.name = "ParsingError";
		this.message = message;
	}
}
