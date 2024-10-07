export interface NodeWithRelationship<ContentType extends object> {
	children: Array<NodeWithRelationship<ContentType>>;
	parent?: NodeWithRelationship<ContentType> | undefined;
	content: ContentType;
}

interface Memory<ContentType extends object> {
	currentNode: NodeWithRelationship<ContentType> | null;
	storage: NodeWithRelationship<ContentType> | null;
}

export class NodeTree<NodeContentType extends object> {
	private root: NodeWithRelationship<NodeContentType> = NodeTree.createNodeWithRelationshipShell(
		null,
		null,
	);
	private current: NodeWithRelationship<NodeContentType>;

	public static createNodeWithRelationshipShell<ContentType extends object>(
		content: ContentType,
		parent: NodeWithRelationship<ContentType> | null,
	): NodeWithRelationship<ContentType> {
		return Object.create(null, {
			content: {
				value: content,
			},
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
		const treeNode = NodeTree.createNodeWithRelationshipShell(value, this.current);

		if (!this.current) {
			this.root.children.push(treeNode);
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

	public pop(): NodeWithRelationship<NodeContentType> | undefined {
		if (!this.current) {
			return undefined;
		}

		const out = this.current;
		this.current = this.current.parent;

		return out;
	}

	public get currentNode(): NodeWithRelationship<NodeContentType> {
		return this.current;
	}

	public get tree(): Memory<NodeContentType>["storage"] {
		return this.root.children[0];
	}

	public get parentNode(): NodeWithRelationship<NodeContentType> | null {
		return this.currentNode?.parent;
	}
}
