export class MinimumElementViolationError extends Error {
	public constructor(requiredNodeName: string) {
		super();

		this.name = "MinimumElementViolationError";
		this.message = `Contraint Violation: at least one instance of '${requiredNodeName}' is required in the document, but found none.`;
	}
}
