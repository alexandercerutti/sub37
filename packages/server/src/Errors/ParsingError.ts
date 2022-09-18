import { formatError } from "./utils.js";

export class ParsingError extends Error {
	constructor(originalError: unknown) {
		super();

		const message = `Unable to create parsing session: critical issues prevented content parsing.
	More details below.

	${formatError(originalError)}
`;

		this.name = "ParsingError";
		this.message = message;
	}
}
