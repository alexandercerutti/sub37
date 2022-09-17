export class UnexpectedParsingOutputFormatError extends Error {
	public constructor(rendererName: string, lang: string, output: unknown) {
		super();

		this.name = "UnexpectedParsingOutputFormatError";
		this.message = `${rendererName} output for track in lang ${lang} doesn't seems to respect the required output format.
    Received:

    ${JSON.stringify(output)}
`;
	}
}
