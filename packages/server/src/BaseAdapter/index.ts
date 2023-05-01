import type { CueNode } from "../CueNode.js";
import { AdapterNotOverridingSupportedTypesError } from "../Errors/index.js";

export interface BaseAdapterConstructor {
	supportedType: string;

	ParseResult(data: CueNode[], errors: BaseAdapter.ParseError[]): ParseResult;

	new (): BaseAdapter;
}

export interface BaseAdapter {
	parse(rawContent: unknown): ParseResult;
}

export declare namespace BaseAdapter {
	type ParseResult = InstanceType<typeof ParseResult>;
	type ParseError = InstanceType<typeof ParseError>;
}

/** By doing this way, we also have static props type-checking */
export const BaseAdapter: BaseAdapterConstructor = class BaseAdapter implements BaseAdapter {
	/**
	 * Static property that instructs for which type of subtitles
	 * this adapter should be used. Must be overridden by Adapters
	 */

	public static get supportedType(): string {
		throw new AdapterNotOverridingSupportedTypesError(this.toString());
	}

	/**
	 * The result of any operation performed by any adapter that
	 * extend BaseAdapter
	 *
	 * @param data
	 * @param errors
	 * @returns
	 */

	public static ParseResult(
		data: CueNode[] = [],
		errors: BaseAdapter.ParseError[] = [],
	): ParseResult {
		return new ParseResult(data, errors);
	}

	/**
	 * Returns the human name for the adapter.
	 *
	 * @returns
	 */

	public static toString(): string {
		return this.name ?? "Anonymous adapter";
	}

	/**
	 * Returns a human name for the adapter.
	 *
	 * @returns
	 */

	public toString(): string {
		return this.constructor.name ?? "Anonymous adapter";
	}

	/**
	 * Parses the content of the type specified by supportedType.
	 * It will be called by Server and **must** be overridden by
	 * any Adapter passed to server.
	 *
	 * @param rawContent
	 */

	public parse(rawContent: unknown): ParseResult {
		throw new Error(
			"Adapter doesn't override parse method. Don't know how to parse the content. Content will be ignored.",
		);
	}
};

export class ParseResult {
	public constructor(public data: CueNode[] = [], public errors: BaseAdapter.ParseError[] = []) {}
}

export class ParseError {
	public constructor(
		public error: Error,
		public isCritical: boolean,
		public failedChunk: unknown,
	) {}
}
