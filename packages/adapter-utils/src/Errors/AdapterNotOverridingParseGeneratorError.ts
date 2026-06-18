export class AdapterNotOverridingParseGeneratorError extends Error {
	constructor(adapterName: string) {
		super();

		this.name = "AdapterNotOverridingParseGeneratorError";
		this.message = `${adapterName} does not override instance method 'parse' or it is not a generator.
Can't parse the content. Track will have no cues.

If you are a adapter developer, ensure yourself for your adapter to override all the expected properties.
`;
	}
}
