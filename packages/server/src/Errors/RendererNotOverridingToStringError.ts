export class RendererNotOverridingToStringError extends Error {
	constructor() {
		super();

		this.name = "RendererNotOverridingToStringError";
		this.message = `A renderer you have provided does not override static (and instance) method 'toString' to provide a human-readable name.
	
If you are a renderer developer, ensure yourself for your renderer to override all the expected properties.
`;
	}
}
