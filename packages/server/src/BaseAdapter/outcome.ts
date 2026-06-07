import { CueNode } from "../CueNode";

/**
 * The generic result of a parsing operation performed by an adapter.
 */
export class ParseResult {
	public data: CueNode[];
	public errors: ParseError[];

	public constructor(data: CueNode[], errors: ParseError[]) {
		this.data = data;
		this.errors = errors;
	}
}

/**
 * A single parsing error that is produced by an adapter.
 */
export class ParseError {
	public error: Error;
	public isCritical: boolean;
	public failedChunk: unknown;

	public constructor(error: Error, isCritical: boolean, failedChunk: unknown) {
		this.error = error;
		this.isCritical = isCritical;
		this.failedChunk = failedChunk;
	}
}
