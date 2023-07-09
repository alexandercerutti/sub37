import type { Token } from "../Token";

export default class Node {
	public parent: Node = null;

	constructor(
		/** Zero-based position of cue content */
		public index: number,
		public token: Token,
	) {}
}
