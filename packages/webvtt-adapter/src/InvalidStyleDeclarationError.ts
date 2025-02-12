export class InvalidStyleDeclarationError extends Error {
	constructor() {
		super();
		this.name = "InvalidStyleDeclarationError";
		this.message = `The provided style block is invalid and will be ignored. The block must not contain empty lines and must have either a valid or no selector.`;
	}
}
