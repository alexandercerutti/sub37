/**
 * A tree that, taken a queue, proxies that
 * and saves the nodes in a different structure.
 */

import type { Node } from "./Node";
import type { NodeQueue } from "./NodeQueue";
import type { WithParent } from "./WithParent";

export interface TreeNode<ContentType extends object = object> {
	content: Node<ContentType>["content"];
	children: Array<TreeNode<ContentType>>;
}

export type TreeNodeWithParent<ContentType extends object> = WithParent<TreeNode<ContentType>>;

interface Memory<ContentType extends object> {
	currentNode: TreeNodeWithParent<ContentType> | null;
	storage: TreeNodeWithParent<ContentType> | null;
}

export class NodeTree<NodeContentType extends object> {
	private queue: NodeQueue<NodeContentType>;
	private memory: Memory<NodeContentType> = {
		currentNode: null,
		storage: null,
	};

	public constructor(queue: NodeQueue<NodeContentType>) {
		if (!queue) {
			throw new Error("Cannot build NodeTree: reference queue parameter is missing.");
		}

		this.queue = queue;
	}

	public static createNodeWithParentRelationship<ContentType extends object>(
		current: Node<ContentType>,
		parent: TreeNode<ContentType>,
	): TreeNodeWithParent<ContentType> {
		return Object.create(current, {
			parent: {
				value: parent,
			},
			children: {
				value: [],
				enumerable: true,
			},
		} satisfies PropertyDescriptorMap);
	}

	public track(value: Node<NodeContentType>): TreeNodeWithParent<NodeContentType> {
		const treeNode = NodeTree.createNodeWithParentRelationship(value, this.memory.currentNode);

		if (!this.memory.storage) {
			this.memory.storage = treeNode;
			this.memory.currentNode = treeNode;

			return treeNode;
		}

		this.memory.currentNode.children.push(treeNode);
		return treeNode;
	}

	public push(value: Node<NodeContentType>): void {
		this.queue.push(value);
		const treeNode = this.track(value);
		this.memory.currentNode = treeNode;
	}

	public pop(): TreeNodeWithParent<NodeContentType> {
		const out = this.memory.currentNode;

		if (this.memory.currentNode) {
			this.memory.currentNode = this.memory.currentNode.parent;
		}

		this.queue.pop();
		return out;
	}

	public get currentNode(): TreeNodeWithParent<NodeContentType> {
		return this.memory.currentNode;
	}

	public get tree(): Memory<NodeContentType>["storage"] {
		return this.memory.storage;
	}

	public get parentNode(): TreeNodeWithParent<NodeContentType> | null {
		return this.currentNode?.parent;
	}
}
