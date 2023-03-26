import { BaseAdapter } from "@sub37/server";

export default class Adapter extends BaseAdapter {
	static override get supportedType() {
		return "application/ttml+xml";
	}

	static override toString(): string {
		return "TTML Adapter";
	}

	override toString(): string {
		return "TTML Adapter";
	}

	override parse(rawContent: string): BaseAdapter.ParseResult {
		return BaseAdapter.ParseResult([], []);
	}
}
