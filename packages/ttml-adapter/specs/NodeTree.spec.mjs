import { describe, it, expect } from "@jest/globals";
import { NodeTree } from "../lib/Parser/Tags/NodeTree.js";
import { NodeQueue } from "../lib/Parser/Tags/NodeQueue.js";

/**
 * @typedef {import("../lib/Parser/Token.js").Token} Token
 */

describe("NodeTree", () => {
	/** @type {NodeTree} */
	let nodeTree;

	/** @type {NodeQueue} */
	let nodeQueue;

	beforeEach(() => {
		nodeQueue = new NodeQueue();
		nodeTree = new NodeTree(nodeQueue);
	});

	it("should throw error if built without node queue", () => {
		/**
		 * @type {NodeTree<Token>}
		 */
		let nodeTree;

		expect(() => (nodeTree = new NodeTree())).toThrowError();
	});

	it("should keep NodeQueue in sync when an element is pushed", () => {
		nodeTree.push({ content: 5 });
		expect(nodeTree.tree.content).toBe(5);
		expect(nodeQueue.current.content).toBe(5);
	});

	it("should get out of sync with NodeQueue when an element is tracked", () => {
		/** This is useful to track self-closing tags */

		nodeTree.push({ content: 5 });
		nodeTree.track({ content: 6 });

		expect(nodeQueue.current.content).toBe(5);
	});

	it("should not set an element as latestNode when tracking is performed", () => {
		nodeTree.push({ content: 5 });
		nodeTree.track({ content: 6 });

		expect(nodeTree.currentNode).toMatchObject({ content: 5 });
	});

	it("should upgrade the last used node on the memory when an element is popped out", () => {
		nodeTree.push({ content: 5 });
		nodeTree.push({ content: 6 });

		nodeTree.pop();

		expect(nodeQueue.current).toMatchObject({ content: 5 });
		expect(nodeTree.currentNode).toMatchObject({ content: 5 });
		expect(nodeTree.tree).toMatchObject({
			content: 5,
			children: [
				{
					content: 6,
				},
			],
			parent: null,
		});
	});
});
