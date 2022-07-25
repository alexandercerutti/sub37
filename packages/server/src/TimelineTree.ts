/**
 * Implementation of an Interval Tree or Binary Search Three without nodes
 * deletion feature, specifically tailored on Cues.
 *
 * This solves the issue of "How can we serve several overlapping cues
 * at the same time?
 */

import type { CueNode } from "./model";

class TimelineTreeNode {
	public left: TimelineTreeNode = null;
	public right: TimelineTreeNode = null;

	constructor(public node: CueNode) {}

	public get min(): number {
		return this.node.startTime;
	}

	public get max(): number {
		return this.node.endTime;
	}
}

/**
 * Tree that is navigated to serve
 * the subtitles cues, only with essential
 * features
 */

export class TimelineTree {
	private root: TimelineTreeNode = null;

	public addNode(newNode: CueNode): void {
		const nextTreeNode = new TimelineTreeNode(newNode);

		if (!this.root) {
			this.root = nextTreeNode;
			return;
		}

		let node = this.root;

		while (node !== null) {
			if (newNode.startTime <= node.min) {
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
	 * @param currentTime
	 * @returns
	 */

	public getCurrentNodes(currentTime: number): null | CueNode[] {
		if (!this.root) {
			return null;
		}

		return accumulateMatchingNodes(this.root, currentTime);
	}

	/**
	 * Retrieves all the nodes in order
	 * @returns
	 */

	public getAll(): CueNode[] {
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

function accumulateMatchingNodes(treeNode: TimelineTreeNode, time: number): CueNode[] {
	if (!treeNode) {
		return [];
	}

	const matchingNodes: CueNode[] = [];

	/**
	 * If current node has not yet ended, we might have nodes
	 * on left that might overlap
	 */

	if (time <= treeNode.max) {
		matchingNodes.push(...accumulateMatchingNodes(treeNode.left, time));
	}

	/**
	 * After having processed all the left nodes we can
	 * proceed checking the current one, so we are sure
	 * even unordered nodes will be pushed in the
	 * correct sequence.
	 */

	if (treeNode.min <= time && treeNode.max > time) {
		matchingNodes.push(treeNode.node);
	}

	if (treeNode.min <= time) {
		/**
		 * If current node has started already started, we might have
		 * some nodes that are overlapping or this is just not the node
		 * we are looking for. We don't care if the current
		 * node has finished or not here. Right nodes will be for sure bigger.
		 */

		matchingNodes.push(...accumulateMatchingNodes(treeNode.right, time));
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

function findAllInSubtree(root: TimelineTreeNode): CueNode[] {
	if (!root) {
		return [];
	}

	return [...findAllInSubtree(root.left), root.node, ...findAllInSubtree(root.right)];
}
