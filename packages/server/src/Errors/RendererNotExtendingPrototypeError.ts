export class RendererNotExtendingPrototypeError extends Error {
	constructor(rendererName: string) {
		super();

		this.name = "RendererNotExtendingPrototypeError";
		this.message = `${rendererName} does not extend HSBaseRenderer.

If you are the renderer developer, please ensure yourself that your renderer is correctly extending HSBaseRenderer from
the main package.
`;
	}
}
