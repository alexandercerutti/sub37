import type { BaseAdapter, ParseGenerator } from "../BaseAdapter/index.js";
import { CueNode } from "../CueNode.js";
import {
	UncaughtParsingExceptionError,
	UnexpectedDataFormatError,
	UnexpectedParsingOutputFormatError,
	UnparsableContentError,
} from "../Errors";
import Track, { addCuesSymbol } from "./Track.js";

/**
 *
 * @param {Track} track the track object to which data will be parsed and added to;
 * @param {unknown} content the content to be parsed. It must be of a type that can be
 * 										understood by the adapter assigned to the track;
 * @param {Function} onSafeFailure A function that will be invoked whenever there's a
 * 										non-critical failure during parsing. The function accepts a parameter
 * 										which will be the ParseError object
 */

export function appendChunkToTrack(track: Track, content: unknown): void {
	const { adapter } = track;

	if (track.onSafeFailure && typeof track.onSafeFailure !== "function") {
		throw new Error("Can't use onSafeFailure. Provided element is not a function.");
	}

	try {
		const parseResult = adapter.parse(content);
		runParser(parseResult, track, adapter);
	} catch (err: unknown) {
		if (
			err instanceof UnexpectedParsingOutputFormatError ||
			err instanceof UnparsableContentError
		) {
			throw err;
		}

		throw new UncaughtParsingExceptionError(adapter.toString(), err);
	}
}

function runParser(parser: ParseGenerator, track: Track, adapter: BaseAdapter): void {
	const { value, done } = parser.next();

	if (done || !Array.isArray(value)) {
		return;
	}

	for (const item of value) {
		if (item instanceof CueNode) {
			track[addCuesSymbol](item);
			continue;
		}

		if (item.error) {
			if (item.isCritical) {
				throw new UnparsableContentError(adapter.toString(), item);
			}

			track.onSafeFailure?.(item);
			continue;
		}

		track.onSafeFailure?.({
			error: new UnexpectedDataFormatError(adapter.toString()),
			isCritical: false,
			failedChunk: item,
		});
	}

	setTimeout(() => runParser(parser, track, adapter), 0);
}
