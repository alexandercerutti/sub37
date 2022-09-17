/**
 * When session is provided with a content not supported
 * by the provided renderers, this will error will be emitted
 */

export class UncaughtParsingExceptionError extends Error {
	constructor(rendererName: string, error: unknown) {
		super();

		const message = `Oh no! Parsing through ${rendererName} failed for some uncaught reason.
		
		If you are using a custom renderer, check your renderer first and the content that caused the issue.
		Otherwise, please report it us with a repro case (code + content). Thank you!

		Here below what happened:

    ${JSON.stringify(error)}
`;

		this.name = "UncaughtParsingExceptionError";
		this.message = message;
	}
}
