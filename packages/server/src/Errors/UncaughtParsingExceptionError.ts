/**
 * When session is provided with a content not supported
 * by the provided adapters, this will error will be emitted
 */

import { formatError } from "./utils.js";

export class UncaughtParsingExceptionError extends Error {
	constructor(adapterName: string, error: unknown) {
		super();

		const message = `Oh no! Parsing through ${adapterName} failed for some uncaught reason.

	If you are using a custom adapter (out of the provided ones), check your adapter first and the content that caused the issue.
	Otherwise, please report it us with a repro case (code + content). Thank you!

	Here below what happened:

	${formatError(error)}
`;

		this.name = "UncaughtParsingExceptionError";
		this.message = message;
	}
}
