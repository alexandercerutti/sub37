/**
 * When Server will be instantiated without renderers, this will be the resulting error
 */

export class UnsupportedContentError extends Error {
	constructor(expectedMimeType: string) {
		super();

		const message = `None of the provided renderers seems to support this content type ("${expectedMimeType}"). Matching against 'supportedType' failed. Engine halted.`;

		this.name = "UnsupportedContentError";
		this.message = message;
	}
}
