import { ParseResult } from "../BaseAdapter";
import { CueNode } from "../CueNode";
import {
	UncaughtParsingExceptionError,
	UnexpectedDataFormatError,
	UnexpectedParsingOutputFormatError,
	UnparsableContentError,
} from "../Errors";
import Track, { addCuesSymbol } from "./Track";

/**
 *
 * @param {Track} track the track object to which data will be parsed and added to;
 * @param {unknown} content the content to be parsed. It must be of a type that can be
 * 										understood by the adapter assigned to the track;
 * @param {Function} onSafeFailure A function that will be invoked whenever there's a
 * 										non-critical failure during parsing. The function accepts a parameter
 * 										which will be the Error object
 */

export function appendChunkToTrack(
	track: Track,
	content: unknown,
	onSafeFailure?: (error: Error) => void,
): void {
	const { adapter, lang } = track;

	try {
		const parseResult = adapter.parse(content);

		if (!(parseResult instanceof ParseResult)) {
			/** If parser fails once for this reason, it is worth to stop the whole ride. */
			throw new UnexpectedParsingOutputFormatError(adapter.toString(), lang, parseResult);
		}

		if (parseResult.data.length) {
			for (const cue of parseResult.data) {
				if (!(cue instanceof CueNode)) {
					parseResult.errors.push({
						error: new UnexpectedDataFormatError(adapter.toString()),
						failedChunk: cue,
						isCritical: false,
					});

					continue;
				}

				track[addCuesSymbol](cue);
			}
		} else if (parseResult.errors.length >= 1) {
			throw new UnparsableContentError(adapter.toString(), parseResult.errors[0]);
		}

		if (typeof onSafeFailure === "function") {
			for (const parseResultError of parseResult.errors) {
				onSafeFailure(parseResultError.error);
			}
		}
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
