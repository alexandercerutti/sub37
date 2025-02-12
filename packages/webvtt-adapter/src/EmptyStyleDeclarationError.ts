export class EmptyStyleDeclarationError extends Error {
	constructor() {
		super();
		this.name = "EmptyStyleDeclarationError";
		this.message = `The provided style block resulted in an empty css ruleset.`;
	}
}
