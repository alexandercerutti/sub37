import { CueNode } from "../CueNode";

export type ParseGenerator = Generator<CueNode[] | ParseError[], void | ParseError[], unknown>;

/**
 * A single parsing error that is produced by an adapter.
 */
export interface ParseError {
	error: Error;
	isCritical: boolean;
	failedChunk?: unknown;
}
