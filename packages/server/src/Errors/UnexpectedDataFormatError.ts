export class UnexpectedDataFormatError extends Error {
	public constructor(rendererName: string) {
		super();

		this.name = "UnexpectedDataFormatError";
		this.message = `${rendererName} returned an object that has a format different from the expected CueNode. This "cue" has been ignored.`;
	}
}
