export class RendererNotOverridingSupportedTypesError extends Error {
	constructor(rendererName: string) {
		super();

		this.name = "RendererNotOverridingSupportedTypesError.ts";
		this.message = `${rendererName} does not override static property method 'supportedTypes' to provide supported mime-types subtitles formats.
	
If you are a renderer developer, ensure yourself for your renderer to override all the expected properties.
`;
	}
}
