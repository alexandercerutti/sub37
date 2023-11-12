import { describe, it, expect } from "@jest/globals";
import { NodeTree } from "../lib/Parser/Tags/NodeTree.js";
import { NodeQueue } from "../lib/Parser/Tags/NodeQueue.js";

/**
 * @typedef {import("../lib/Parser/Token.js").Token} Token
 */

describe("NodeTree", () => {
	/** @type {NodeTree} */
	let nodeTree;

	beforeEach(() => {
		nodeTree = new NodeTree();
	});

	it("should keep NodeQueue in sync when an element is pushed", () => {
		nodeTree.push({ content: 5 });

		expect(nodeTree.pop()).toMatchObject({
			content: {
				content: 5,
			},
		});
	});

	it("should keep the last pushed element as current when another one is tracked", () => {
		/** This is useful to track self-closing tags */

		nodeTree.push({ content: 5 });
		nodeTree.track({ content: 6 });

		expect(nodeTree.currentNode).toMatchObject({
			content: {
				content: 5,
			},
			children: [
				{
					content: {
						content: 6,
					},
					children: [],
				},
			],
		});
	});

	it("should upgrade the last used node on the memory when an element is popped out", () => {
		nodeTree.push({ content: 5 });
		nodeTree.push({ content: 6 });

		nodeTree.pop();

		expect(nodeTree.currentNode).toMatchObject({ content: { content: 5 } });
		expect(nodeTree.tree).toMatchObject({
			content: {
				content: 5,
			},
			children: [
				{
					content: {
						content: 6,
					},
					children: [],
				},
			],
		});
	});
});
