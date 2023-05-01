import { BaseAdapter } from "@sub37/server";

export default class TTMLAdapter extends BaseAdapter {
	static override get supportedType() {
		return "application/ttml+xml";
	}

	override parse(rawContent: string): BaseAdapter.ParseResult {
		return BaseAdapter.ParseResult([], []);
	}
}
