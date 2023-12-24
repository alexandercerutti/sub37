interface NavigationDescriptor {
	navigate(): void;
}

export class RelationshipTree {
	private root: RelationshipNode;
	private currentElement: RelationshipNode;

	public constructor() {
		this.root = parentLinkedTree(
			createRelationshipNode(null, [
				createRelationshipNode("tt", [
					createRelationshipNode("head", [
						createRelationshipNode("styling", [
							createRelationshipNode("initial"),
							createRelationshipNode("style"),
						]),
						createRelationshipNode("layout", [createRegionNode()]),
					]),
					createRelationshipNode("body", [
						createRelationshipNode(
							"div",
							[
								createRegionNode(),
								createRelationshipNode("p", [
									createRegionNode(),
									createRelationshipNode("span", [], true),
									createRelationshipNode("br"),
								]),
							],
							true,
						),
					]),
				]),
			]),
		);

		this.currentElement = this.root;
	}

	public get currentNode() {
		return this.currentElement;
	}

	public getDirectionDescriptor(name: string): NavigationDescriptor | null {
		const element = this.currentElement.getDirectionByName(name);

		if (!element) {
			return null;
		}

		return {
			navigate: () => {
				this.currentElement = element;
			},
		};
	}
}

function createRegionNode(): RelationshipNode {
	return createRelationshipNode("region", [createRelationshipNode("style")]);
}

interface RelationshipNode {
	readonly name: string;
	readonly directions: Map<string, RelationshipNode>;
	getDirectionByName(element: string): RelationshipNode;
	addDirections(...directions: RelationshipNode[]): void;
}

function createRelationshipNode(
	name: string,
	directions: RelationshipNode[] = [],
	selfNavigatable: boolean = false,
): RelationshipNode {
	const availableDirections = new Map<string, RelationshipNode>();

	const node = {
		name,
		directions: availableDirections,
		getDirectionByName(element: string): RelationshipNode {
			return availableDirections.get(element);
		},
		addDirections(...routes: RelationshipNode[]): void {
			for (const direction of routes) {
				availableDirections.set(direction.name, direction);
			}
		},
	} satisfies RelationshipNode;

	node.addDirections(...directions);

	if (selfNavigatable) {
		availableDirections.set(name, node);
	}

	return node;
}

function parentLinkedTree(node: RelationshipNode, parent?: RelationshipNode): RelationshipNode {
	/**
	 * Self-linked elements
	 */
	if (node === parent) {
		return node;
	}

	for (const [, direction] of node.directions) {
		parentLinkedTree(direction, node);
	}

	if (parent) {
		node.addDirections(parent);
	}

	return node;
}
