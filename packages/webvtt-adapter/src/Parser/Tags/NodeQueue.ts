import type Node from "./Node";

/**
 * LIFO queue, where root is always the first element,
 * so we can easily pop out and not drill.
 */

export default class NodeQueue {
	private root: Node = null;

	public get current() {
		return this.root;
	}

	public get length(): number {
		if (!this.root) {
			return 0;
		}

		let thisNode: Node = this.root;
		let length = 1;

		while (thisNode.parent !== null) {
			length++;
			thisNode = thisNode.parent;
		}

		return length;
	}

	public push(node: Node): void {
		if (!this.root) {
			this.root = node;
			return;
		}

		node.parent = this.root;
		this.root = node;
	}

	public pop(): Node | undefined {
		if (!this.root) {
			return undefined;
		}

		const out = this.root;
		this.root = this.root.parent;
		return out;
	}
}
