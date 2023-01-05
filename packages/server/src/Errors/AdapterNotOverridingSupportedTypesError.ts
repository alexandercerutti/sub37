export class AdapterNotOverridingSupportedTypesError extends Error {
	constructor(adapterName: string) {
		super();

		this.name = "AdapterNotOverridingSupportedTypesError.ts";
		this.message = `${adapterName} does not override static property method 'supportedTypes' to provide supported mime-types subtitles formats.
	
If you are a adapter developer, ensure yourself for your adapter to override all the expected properties.
`;
	}
}
