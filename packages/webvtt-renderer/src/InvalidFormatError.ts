/**
 * When VTT file doesn't start with WEBVTT format
 */

type Reason = "WEBVTT_HEADER_MISSING" | "UNKNOWN_BLOCK_ENTITY" | "INVALID_CUE_FORMAT";

export class InvalidFormatError extends Error {
	constructor(reason: Reason, dataBlock: string) {
		super();

		const message = `Content provided to WebVTTRenderer is invalid.

	Reason Code: ${reason}.

	Parser stopped at the following code block follows:

	=============
	${dataBlock.replace(/\n/g, "\n\t")}
	=============
`;

		this.name = "InvalidFormatError";
		this.message = message;
	}
}
