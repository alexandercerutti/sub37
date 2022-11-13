import type { CueNode } from "../CueNode.js";
import { RendererNotOverridingSupportedTypesError } from "../Errors/index.js";

export interface HSBaseRendererConstructor {
	supportedType: string;

	ParseResult(data: CueNode[], errors: HSBaseRenderer.ParseError[]): ParseResult;

	/**
	 * Used for printing Renderer human name
	 */

	toString(): string;

	new (): HSBaseRenderer;
}

export interface HSBaseRenderer {
	parse(rawContent: unknown): ParseResult;

	/**
	 * Used for printing Renderer human name
	 */

	toString(): string;
}

export declare namespace HSBaseRenderer {
	type ParseResult = InstanceType<typeof ParseResult>;
	type ParseError = InstanceType<typeof ParseError>;
}

/** By doing this way, we also have static props type-checking */
export const HSBaseRenderer: HSBaseRendererConstructor = class HSBaseRenderer
	implements HSBaseRenderer
{
	/**
	 * Static property that instructs for which type of subtitles
	 * this renderer should be used. Must be overridden by Renderers
	 */

	public static get supportedType(): string {
		throw new RendererNotOverridingSupportedTypesError(this.toString());
	}

	/**
	 * The result of any operation performed by any renderer that
	 * extend BaseRenderer
	 *
	 * @param data
	 * @param errors
	 * @returns
	 */

	public static ParseResult(
		data: CueNode[] = [],
		errors: HSBaseRenderer.ParseError[] = [],
	): ParseResult {
		return new ParseResult(data, errors);
	}

	/**
	 * Returns a human name for the renderer. This property
	 * **must** be overridden by any Renderer passed to the
	 * server.
	 *
	 * @returns
	 */

	public static toString(): string {
		return "default";
	}

	/**
	 * Returns a human name for the renderer. This property
	 * **must** be overridden by any Renderer passed to the
	 * server.
	 *
	 * @returns
	 */

	public toString(): string {
		return "default";
	}

	/**
	 * Parses the content of the type specified by supportedType.
	 * It will be called by HSServer and **must** be overridden by
	 * any Renderer passed to server.
	 *
	 * @param rawContent
	 */

	public parse(rawContent: unknown): ParseResult {
		throw new Error(
			"Renderer doesn't override parse method. Don't know how to parse the content. Content will be ignored.",
		);
	}
};

export class ParseResult {
	public constructor(
		public data: CueNode[] = [],
		public errors: HSBaseRenderer.ParseError[] = [],
	) {}
}

export class ParseError {
	public constructor(
		public error: Error,
		public isCritical: boolean,
		public failedChunk: unknown,
	) {}
}
