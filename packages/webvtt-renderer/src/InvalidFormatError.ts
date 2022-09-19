/**
 * When VTT file doesn't start with WEBVTT format
 */

type Reason = "WEBVTT_HEADER_MISSING" | "UNKNOWN_BLOCK_ENTITY" | "INVALID_CUE_FORMAT";

export class InvalidFormatError extends Error {
	constructor(reason: Reason, dataBlock: string) {
		super();

		this.name = "InvalidFormatError";

		if (reason === "WEBVTT_HEADER_MISSING") {
			this.message = `Content provided to WebVTTRenderer cannot be parsed.

	Reason code: ${reason}
			`;
		} else {
			this.message = `Content provided to WebVTTRenderer cannot be parsed.
			
	Reason code: ${reason}
	
	This block seems to be invalid:

	=============
	${dataBlock.replace(/\n/g, "\n\t")}
	=============
`;
		}
	}
}
