import type { CueNode } from "@hsubs/server";

export interface HSBaseRendererConstructor<T> {
	supportedType: string;
	new (): HSBaseRenderer<T>;
}

export interface HSBaseRenderer<R> {
	parse(rawContent: R): CueNode[];
}

export class HSBaseRenderer<R> implements HSBaseRenderer<R> {
	/**
	 * Static property that instructs for which type of subtitles
	 * this renderer should be used. Must be overridden by Renderers
	 */

	static get supportedType() {
		throw new Error(
			"Renderer didn't specify any static supportedType property. Renderer will be ignored.",
		);
	}

	/**
	 * Parses the content of the type specified by supportedType.
	 * It will be called by HSServer and **must** be overridden by
	 * any Renderer passed to server.
	 *
	 * @param rawContent
	 */

	parse(rawContent: R): CueNode[] {
		throw new Error(
			"Renderer doesn't override parse method. Don't know how to parse the content. Content will be ignored.",
		);
	}
}
