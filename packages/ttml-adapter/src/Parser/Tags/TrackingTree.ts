import { NodeTree, NodeWithRelationship } from "./NodeTree.js";

const trackingSymbol = Symbol("tracking");

interface TrackedNode {
	[trackingSymbol]: true;
}

interface UntrackedNode {
	[trackingSymbol]: false;
}

type TrackableNode<T extends object> = T & (TrackedNode | UntrackedNode);

export class TrackingTree<ContentType extends object> {
	private tree: NodeTree<TrackableNode<ContentType>> = new NodeTree<TrackableNode<ContentType>>();

	public static isTracked<ContentType extends object>(
		node: ContentType,
	): node is ContentType & TrackedNode {
		return Boolean((node as TrackableNode<ContentType>)[trackingSymbol]);
	}

	public addTrackedNode(node: ContentType): void {
		const trackedNode = createTrackedNode(node);
		this.tree.push(trackedNode);
	}

	public addUntrackedNode(node: ContentType): void {
		const untrackedNode = createUntrackedNode(node);
		this.tree.push(untrackedNode);
	}

	public pop(): NodeWithRelationship<TrackableNode<ContentType>> | null {
		const { parentNode } = this.tree;

		if (!parentNode) {
			return this.tree.pop();
		}

		if (TrackingTree.isTracked(parentNode?.content)) {
			this.tree.ascend();
			return null;
		}

		return this.tree.pop();
	}

	public get currentNode(): NodeWithRelationship<TrackableNode<ContentType>> {
		return this.tree.currentNode;
	}
}

function createTrackedNode(content: object): TrackedNode {
	return Object.create(content, {
		[trackingSymbol]: {
			value: true,
		},
	} satisfies PropertyDescriptorMap);
}

function createUntrackedNode(content: object): UntrackedNode {
	return Object.create(content, {
		[trackingSymbol]: {
			value: false,
		},
	} satisfies PropertyDescriptorMap);
}
