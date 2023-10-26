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
	private root: TreeNodeWithParent<NodeContentType>;
	private current: TreeNodeWithParent<NodeContentType>;

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
				value: parent || null,
			},
			children: {
				value: [],
				enumerable: true,
			},
		} satisfies PropertyDescriptorMap);
	}

	public track(value: Node<NodeContentType>): TreeNodeWithParent<NodeContentType> {
		const treeNode = NodeTree.createNodeWithParentRelationship(value, this.current);

		if (!this.root) {
			this.root = treeNode;
			this.current = treeNode;

			return treeNode;
		}

		this.current.children.push(treeNode);
		return treeNode;
	}

	public push(value: Node<NodeContentType>): void {
		this.queue.push(value);
		const treeNode = this.track(value);
		this.current = treeNode;
	}

	public pop(): TreeNodeWithParent<NodeContentType> {
		const out = this.current;

		if (this.current) {
			this.current = this.current.parent;
		}

		this.queue.pop();
		return out;
	}

	public get currentNode(): TreeNodeWithParent<NodeContentType> {
		return this.current;
	}

	public get tree(): Memory<NodeContentType>["storage"] {
		return this.root;
	}

	public get parentNode(): TreeNodeWithParent<NodeContentType> | null {
		return this.currentNode?.parent;
	}
}
