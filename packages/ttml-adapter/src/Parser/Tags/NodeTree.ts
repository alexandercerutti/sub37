export interface NodeWithRelationship<ContentType extends object> {
	children: Array<NodeWithRelationship<ContentType>>;
	parent?: NodeWithRelationship<ContentType> | null;
	content: ContentType;
}

export class NodeTree<NodeContentType extends object> {
	private root: NodeWithRelationship<NodeContentType> =
		createNodeWithRelationshipShell<NodeContentType>(null, null);
	private current: NodeWithRelationship<NodeContentType> | null = null;

	public track(value: NodeContentType): NodeWithRelationship<NodeContentType> {
		const treeNode = createNodeWithRelationshipShell(value, this.current);

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
		this.current = this.current.parent || null;

		return out;
	}

	public get currentNode(): NodeWithRelationship<NodeContentType> {
		return this.current!;
	}
}

function createNodeWithRelationshipShell<ContentType extends object>(
	content: ContentType | null,
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
