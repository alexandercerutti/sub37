/**
 * Implementation of an Interval Tree or Binary Search Three without nodes
 * deletion feature.
 *
 * This solves the issue of "How can we serve several overlapping cues
 * at the same time?
 */

export interface IntervalBinaryLeaf<LeafShape extends object> {
	left: IntervalBinaryLeaf<LeafShape> | null;
	right: IntervalBinaryLeaf<LeafShape> | null;
	node: LeafShape;
	get min(): number;
	get max(): number;
}

export interface Leafable<LeafShape extends object> {
	toLeaf(): IntervalBinaryLeaf<LeafShape>;
}

export class IntervalBinaryTree<LeafShape extends object> {
	private root: IntervalBinaryLeaf<LeafShape> = null;

	public addNode(newNode: Leafable<LeafShape> | IntervalBinaryLeaf<LeafShape>): void {
		const nextTreeNode = isLeafable(newNode) ? newNode.toLeaf() : newNode;

		if (!this.root) {
			this.root = nextTreeNode;
			return;
		}

		let node = this.root;

		while (node !== null) {
			if (nextTreeNode.min <= node.min) {
				if (!node.left) {
					node.left = nextTreeNode;
					return;
				}

				node = node.left;
			} else {
				if (!node.right) {
					node.right = nextTreeNode;
					return;
				}

				node = node.right;
			}
		}
	}

	/**
	 * Retrieves nodes which startTime and endTime are inside
	 *
	 * @param query
	 * @returns
	 */

	public getCurrentNodes(query: number): null | IntervalBinaryLeaf<LeafShape>["node"][] {
		if (!this.root) {
			return null;
		}

		return accumulateMatchingNodes(this.root, query);
	}

	/**
	 * Retrieves all the nodes in order
	 * @returns
	 */

	public getAll(): IntervalBinaryLeaf<LeafShape>["node"][] {
		return findAllInSubtree(this.root);
	}
}

/**
 * Handles exploration of the tree starting from a specific node
 * and checking if every queried node's startTime and endTime are
 * an interval containing time parameter
 *
 * @param treeNode
 * @param time
 * @returns
 */

function accumulateMatchingNodes<LeafShape extends object>(
	treeNode: IntervalBinaryLeaf<LeafShape>,
	query: number,
): IntervalBinaryLeaf<LeafShape>["node"][] {
	if (!treeNode) {
		return [];
	}

	const matchingNodes: IntervalBinaryLeaf<LeafShape>["node"][] = [];

	/**
	 * If current node has not yet ended, we might have nodes
	 * on left that might overlap
	 */

	if (query <= treeNode.max) {
		matchingNodes.push(...accumulateMatchingNodes(treeNode.left, query));
	}

	/**
	 * After having processed all the left nodes we can
	 * proceed checking the current one, so we are sure
	 * even unordered nodes will be pushed in the
	 * correct sequence.
	 */

	if (treeNode.min <= query && treeNode.max > query) {
		matchingNodes.push(treeNode.node);
	}

	if (treeNode.min <= query) {
		/**
		 * If current node has started already started, we might have
		 * some nodes that are overlapping or this is just not the node
		 * we are looking for. We don't care if the current
		 * node has finished or not here. Right nodes will be for sure bigger.
		 */

		matchingNodes.push(...accumulateMatchingNodes(treeNode.right, query));
	}

	return matchingNodes;
}

/**
 * Recursively scans and accumulate the nodes in the subtree
 * starting from an arbitrary root node
 *
 * @param root
 * @returns
 */

function findAllInSubtree<LeafShape extends object>(
	root: IntervalBinaryLeaf<LeafShape>,
): IntervalBinaryLeaf<LeafShape>["node"][] {
	if (!root) {
		return [];
	}

	return [...findAllInSubtree(root.left), root.node, ...findAllInSubtree(root.right)];
}

function isLeafable(node: unknown): node is Leafable<object> {
	return typeof (node as Leafable<object>).toLeaf === "function";
}
