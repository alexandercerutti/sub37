import type { Node, NodeWithParent } from "./Node";

/**
 * LIFO queue, where root is always the first element,
 * so we can easily pop out and not drill.
 */

export class NodeQueue<ContentType extends object> {
	private root: NodeWithParent<ContentType> = null;

	public get current() {
		return this.root;
	}

	public get length(): number {
		if (!this.root) {
			return 0;
		}

		let thisNode: NodeWithParent<ContentType> = this.root;
		let length = 1;

		while (thisNode.parent !== null) {
			length++;
			thisNode = thisNode.parent;
		}

		return length;
	}

	public push(node: Node<ContentType>): void {
		const queueNode = Object.create(node, {
			parent: {
				value: this.root,
			},
		} satisfies PropertyDescriptorMap);

		this.root = queueNode;
	}

	public pop(): Node<ContentType> | undefined {
		if (!this.root) {
			return undefined;
		}

		const out = this.root;
		this.root = this.root.parent;
		return out;
	}
}
