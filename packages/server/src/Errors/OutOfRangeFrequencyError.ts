/**
 * When Server will be instantiated without adapters, this will be the resulting error
 */

export class OutOfRangeFrequencyError extends Error {
	constructor(frequency: number) {
		super();

		const message = `Cannot start subtitles server.

  Custom frequency requires to be a positive numeric value higher than 0ms.
  If not provided, it is automatically set to 250ms. Received: ${frequency} (ms).
`;

		this.name = "OutOfRangeFrequencyError";
		this.message = message;
	}
}
