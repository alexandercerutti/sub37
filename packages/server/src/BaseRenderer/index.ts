import type { CueNode } from "../CueNode.js";

export interface HSBaseRendererConstructor {
	supportedType: string;
	new (): HSBaseRenderer;
}

export interface HSBaseRenderer {
	parse(rawContent: unknown): CueNode[];
}

/** By doing this way, we also have static props type-checking */
export const HSBaseRenderer: HSBaseRendererConstructor = class HSBaseRenderer
	implements HSBaseRenderer
{
	/**
	 * Static property that instructs for which type of subtitles
	 * this renderer should be used. Must be overridden by Renderers
	 */

	static get supportedType(): string {
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

	parse(rawContent: unknown): CueNode[] {
		throw new Error(
			"Renderer doesn't override parse method. Don't know how to parse the content. Content will be ignored.",
		);
	}
};
