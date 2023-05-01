/**
 * @deprecated
 */

export class AdapterNotOverridingToStringError extends Error {
	constructor() {
		super();

		this.name = "AdapterNotOverridingToStringError";
		this.message = `A adapter you have provided does not override static (and instance) method 'toString' to provide a human-readable name.
	
If you are a adapter developer, ensure yourself for your adapter to override all the expected properties.
`;
	}
}
