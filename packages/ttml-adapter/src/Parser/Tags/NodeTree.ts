interface GenericNode<ContentType extends object> {
	content: ContentType;
}

export interface NodeWithRelationship<ContentType extends object> extends GenericNode<ContentType> {
	children: Array<NodeWithRelationship<ContentType>>;
	parent: NodeWithRelationship<ContentType>;
}

interface Memory<ContentType extends object> {
	currentNode: NodeWithRelationship<ContentType> | null;
	storage: NodeWithRelationship<ContentType> | null;
}

export class NodeTree<NodeContentType extends object> {
	private root: NodeWithRelationship<NodeContentType>;
	private current: NodeWithRelationship<NodeContentType>;

	public static createGenericNode<ContentType extends object>(
		content: ContentType,
	): GenericNode<ContentType> {
		return Object.create(null, {
			content: {
				value: content,
			},
		});
	}

	public static createNodeWithRelationship<ContentType extends object>(
		current: GenericNode<ContentType>,
		parent: NodeWithRelationship<ContentType>,
	): NodeWithRelationship<ContentType> {
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

	public track(value: NodeContentType): NodeWithRelationship<NodeContentType> {
		const treeNode = NodeTree.createNodeWithRelationship(
			NodeTree.createGenericNode(value),
			this.current,
		);

		if (!this.root) {
			this.root = treeNode;
			this.current = treeNode;

			return treeNode;
		}

		this.current.children.push(treeNode);
		return treeNode;
	}

	public push(value: NodeContentType): void {
		const treeNode = this.track(value);
		this.current = treeNode;
	}

	/**
	 * Removes the current node and returns it
	 * @returns
	 */

	public pop(): NodeWithRelationship<NodeContentType> {
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

	public get currentNode(): NodeWithRelationship<NodeContentType> {
		return this.current;
	}

	public get tree(): Memory<NodeContentType>["storage"] {
		return this.root;
	}

	public get parentNode(): NodeWithRelationship<NodeContentType> | null {
		return this.currentNode?.parent;
	}
}
