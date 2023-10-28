/**
 * A tree that, taken a queue, proxies that
 * and saves the nodes in a different structure.
 */

import type { Node } from "./Node";
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
	private root: TreeNodeWithParent<NodeContentType>;
	private current: TreeNodeWithParent<NodeContentType>;

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
		const treeNode = this.track(value);
		this.current = treeNode;
	}

	/**
	 * Removes the current node and returns it
	 * @returns
	 */

	public pop(): TreeNodeWithParent<NodeContentType> {
		const out = this.current;

		this.ascend();
		return out;
	}

	/**
	 * Changes the pointer to the current node without
	 * removing the last child
	 */

	public ascend(): void {
		if (!this.current) {
			return;
		}

		this.current = this.current.parent;
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
