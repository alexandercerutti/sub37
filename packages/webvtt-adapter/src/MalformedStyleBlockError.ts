export class MalformedStyleBlockError extends Error {
	constructor() {
		super();
		this.name = "MalformedStyleBlockError";
		this.message = `The provided style block is malformed. Will be ignored. STYLE declaration must be immediately followed by the '::cue' declaration (no empty lines allowed).`;
	}
}
