export class RelationshipTree {
	private root: RelationshipNode;
	private currentElement: RelationshipNode;

	public constructor() {
		this.root = new RelationshipNode("tt", [
			new RelationshipNode("head", [
				new RelationshipNode("styling", [
					new RelationshipNode("initial"),
					new RelationshipNode("style"),
				]),
				new RelationshipNode("layout", [createRegionNode()]),
			]),
			new RelationshipNode("body", [
				new RelationshipNode("div", [
					createRegionNode(),
					new RelationshipNode("p", [
						createRegionNode(),
						new RelationshipNode("span"),
						new RelationshipNode("br"),
					]),
				]).setSelfReference(),
			]),
		]);

		associateNodeParents(this.root);
		this.currentElement = this.root;
	}

	public get currentNode() {
		return this.currentElement;
	}

	public ascend(): void {
		if (!this.currentElement) {
			return;
		}

		this.currentElement = this.currentElement.parent;
	}

	public setCurrent(element: RelationshipNode) {
		if (!element || this.currentElement === element) {
			return;
		}

		this.currentElement = element;
	}
}

function associateNodeParents(node: RelationshipNode): void {
	if (!node) {
		return;
	}

	for (const children of node.children) {
		children.parent = node;

		if (children.element !== node.element) {
			associateNodeParents(children);
		}
	}
}

function createRegionNode(): RelationshipNode {
	return new RelationshipNode("region", [new RelationshipNode("style")]);
}

class RelationshipNode {
	parent: RelationshipNode = null;
	element: string;
	children: Array<RelationshipNode> = [];

	constructor(element: string, children?: Array<RelationshipNode>) {
		this.element = element;

		if (children?.length) {
			this.children.push(...children);
		}
	}

	public setSelfReference(): this {
		this.children.push(this);
		return this;
	}

	public has(element: string): boolean {
		return this.children.some((node) => node.element === element);
	}

	public get(element: string): RelationshipNode {
		return this.children.find((node) => node.element === element);
	}
}
