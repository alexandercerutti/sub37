export class UnexpectedDataFormatError extends Error {
	public constructor(adapterName: string) {
		super();

		this.name = "UnexpectedDataFormatError";
		this.message = `${adapterName} returned an object that has a format different from the expected CueNode. This "cue" has been ignored.`;
	}
}
