/**
 * When content fails fatally
 */

import { formatError } from "./utils.js";

export class UnparsableContentError extends Error {
	constructor(adapterName: string, error: unknown) {
		super();

		const message = `${adapterName} failed on every section of the provided content or critically failed on a point.
		
		${formatError(error)}
		`;

		this.name = "UnparsableContentError";
		this.message = message;
	}
}
