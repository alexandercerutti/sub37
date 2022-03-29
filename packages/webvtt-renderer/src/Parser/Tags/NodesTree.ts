import Node from "./Node";

/**
 * "Reversed" tree, where the root is always the
 * root, so we can pop easily and we don't have to
 * drill to perform operations on the last element
 */

export default class NodeTree {
	private root: Node = null;

	public get current() {
		return this.root;
	}

	public get length() {
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

	public push(node: Node) {
		if (!this.root) {
			this.root = node;
			return;
		}

		node.parent = this.root;
		this.root = node;
	}

	public pop() {
		if (!this.root) {
			return;
		}

		const out = this.root;
		this.root = this.root.parent;
		return out;
	}
}
