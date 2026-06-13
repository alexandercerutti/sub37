import { AdapterNotOverridingSupportedTypesError } from "../Errors/AdapterNotOverridingSupportedTypesError.js";
import type { ParseGenerator } from "./outcome.js";

export interface BaseAdapterConstructor {
	supportedType: string;
	new (): BaseAdapter;
}

export interface BaseAdapter {
	parse(rawContent: unknown): ParseGenerator;
}

export type { ParseError, ParseGenerator } from "./outcome.js";

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

	public *parse(_rawContent: unknown): ParseGenerator {
		throw new Error(
			"Adapter doesn't override parse method. Can't parse the content. Track will have no cues.",
		);
	}
};
