export class RelationshipTree {
	private root: RelationshipNode;
	private currentElement: RelationshipNode;

	public constructor() {
		this.root = new RelationshipNode(null, [
			new RelationshipNode("tt", [
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

	public setCurrent(element: string): void {
		const comparisonNode = new RelationshipNode(element);

		if (!element || RelationshipNode.is(this.currentElement, comparisonNode)) {
			return;
		}

		const directionElement = this.currentElement.get(comparisonNode);

		if (!directionElement) {
			throw new Error(
				`Internal navigation error: cannot navigate from <${this.currentElement}> to <${element}>: unreachable children`,
			);
		}

		this.currentElement = directionElement;
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
	children: Array<RelationshipNode>;

	constructor(element: string | null, children: Array<RelationshipNode> = []) {
		this.element = element;
		this.children = children;
	}

	static is(el1: RelationshipNode, el2: RelationshipNode): boolean {
		if (!el1 || !el2) {
			return false;
		}

		return el1.element === el2.element;
	}

	public setSelfReference(): this {
		this.children.push(this);
		return this;
	}

	public has(element: string): boolean {
		return this.children.some((node) => node.element === element);
	}

	public get(element: RelationshipNode): RelationshipNode {
		return this.children.find((node) => RelationshipNode.is(node, element));
	}
}
