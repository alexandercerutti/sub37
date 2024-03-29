/**
 * When session is provided with a content not supported
 * by the provided adapters, this will error will be emitted
 */

export class UnsupportedContentError extends Error {
	constructor(expectedMimeType: string) {
		super();

		const message = `None of the provided adapters seems to support this content type ("${expectedMimeType}"). Matching against 'supportedType' failed. Engine halted.`;

		this.name = "UnsupportedContentError";
		this.message = message;
	}
}
