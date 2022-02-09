/**
 * Implementation of an Interval Tree or Binary Search Three without nodes
 * deletion feature, specifically tailored on Cues.
 *
 * This solves the issue of "How can we serve several overlapping cues
 * at the same time?
 */

import { Entity } from "@hsubs/server";

export interface CueNode {
	startTime: number;
	endTime: number;
	id?: string;
	styles?: any /** @TODO parse them */;
	entities?: Entity[];
	content: string;
}

class TimelineTreeNode implements CueNode {
	public id?: string;
	public styles?: any /** @TODO parse them */;
	public entities?: Entity[];

	public left: TimelineTreeNode = null;
	public right: TimelineTreeNode = null;

	constructor(public startTime: number, public endTime: number, public content: string) {}
}

/**
 * Tree that is navigated to serve
 * the subtitles cues, only with essential
 * features
 */

export class TimelineTree {
	private root: TimelineTreeNode = null;

	public addNode(newNode: CueNode) {
		const nextTreeNode = new TimelineTreeNode(newNode.startTime, newNode.endTime, newNode.content);

		nextTreeNode.id = newNode.id;
		nextTreeNode.entities = newNode.entities;
		nextTreeNode.styles = newNode.styles;

		if (!this.root) {
			this.root = nextTreeNode;
			return;
		}

		let node = this.root;

		while (node !== null) {
			if (newNode.startTime <= node.startTime) {
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

	public getCurrentNodes(currentTime: number): null | TimelineTreeNode[] {
		if (!this.root) {
			return null;
		}

		return accumulateMatchingNodes(this.root, currentTime);
	}
}

/**
 * Handles exploration of the tree starting from a specific node
 * and checking if every queried node's startTime and endTime are
 * an interval containing time parameter
 *
 * @param node
 * @param time
 * @returns
 */

function accumulateMatchingNodes(node: TimelineTreeNode, time: number) {
	if (!node) {
		return [];
	}

	const matchingNodes: TimelineTreeNode[] = [];

	if (node.startTime <= time && node.endTime > time) {
		matchingNodes.push(node);
	}

	/**
	 * If current node has not yet ended, we might have nodes
	 * on left that might overlap
	 */

	if (time <= node.endTime) {
		matchingNodes.push(...accumulateMatchingNodes(node.left, time));
	}

	if (node.startTime <= time) {
		/**
		 * If current node has started already started, we might have
		 * some nodes that are overlapping or this is just not the node
		 * we are looking for. We don't care if the current
		 * node has finished or not here. Right nodes will be for sure bigger.
		 */

		matchingNodes.push(...accumulateMatchingNodes(node.right, time));
	}

	return matchingNodes;
}
