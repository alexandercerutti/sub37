/**
 * When Server will be instantiated without renderers, this will be the resulting error
 */

export class NoRenderersFoundError extends Error {
	constructor() {
		super();

		const message = `HSServer didn't find any valid Renderer.

  If you are a Renderer developer, please ensure yourself for:
  	- it to extend HSBaseRenderer
  	- it to have static properties overridden:
  		- 'supportedType'
  		- 'rendererName'
  
  See documentation for more details.
		`;

		this.name = "UnmatchedRendererError";
		this.message = message;
	}
}
