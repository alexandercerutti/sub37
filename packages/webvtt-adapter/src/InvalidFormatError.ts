/**
 * When VTT file doesn't start with WEBVTT format
 */

type Reason =
	| "WEBVTT_HEADER_MISSING"
	| "UNKNOWN_BLOCK_ENTITY"
	| "INVALID_CUE_FORMAT"
	| "WEBVTT_HEADER_X_TIMESTAMP_MAP_INVALID";

export class InvalidFormatError extends Error {
	constructor(reason: Reason, dataBlock: string) {
		super();

		this.name = "InvalidFormatError";

		if (reason === "WEBVTT_HEADER_MISSING") {
			this.message = `Content provided to WebVTTAdapter cannot be parsed.

	Reason code: ${reason}
			`;
		} else {
			this.message = `Content provided to WebVTTAdapter cannot be parsed.
			
	Reason code: ${reason}
	
	This block seems to be invalid:

	=============
	${dataBlock.replace(/\n/g, "\n\t")}
	=============
`;
		}
	}
}
