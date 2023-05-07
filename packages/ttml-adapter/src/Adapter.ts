import { BaseAdapter } from "@sub37/server";
import { MissingContentError } from "./MissingContentError";

export default class TTMLAdapter extends BaseAdapter {
	static override get supportedType() {
		return "application/ttml+xml";
	}

	override parse(rawContent: string): BaseAdapter.ParseResult {
		if (!rawContent) {
			return BaseAdapter.ParseResult(undefined, [
				{
					error: new MissingContentError(),
					failedChunk: "",
					isCritical: true,
				},
			]);
		}

		return BaseAdapter.ParseResult([], []);
	}
}
