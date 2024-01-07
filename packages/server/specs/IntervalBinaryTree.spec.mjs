// @ts-check
import { describe, it, expect, beforeEach } from "@jest/globals";
import { IntervalBinaryTree } from "../lib/IntervalBinaryTree.js";
import { CueNode } from "../lib/CueNode.js";

describe("IntervalBinaryTree", () => {
	/** @type {IntervalBinaryTree} */
	let tree;

	beforeEach(() => {
		tree = new IntervalBinaryTree();
	});

	it("should assign nodes to the correct timeframe", () => {
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content",
					startTime: 11000,
					endTime: 12000,
				}),
			),
		);

		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content",
					startTime: 0,
					endTime: 10000,
				}),
			),
		);

		const query1 = tree.getCurrentNodes(0);

		expect(query1?.length).toBe(1);
		expect(query1?.[0]).toMatchObject({
			content: "A test content",
			startTime: 0,
			endTime: 10000,
		});

		const query2 = tree.getCurrentNodes(11500);

		expect(query2?.length).toBe(1);
		expect(query2?.[0]).toMatchObject({
			content: "A test content",
			startTime: 11000,
			endTime: 12000,
		});
	});

	it("should return all the overlapping nodes for the selected time moment", () => {
		/**
		 * Test: the second node ends at the same moment of the "parent".
		 * For example, VTT Timestamps
		 */
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test master-content",
					startTime: 0,
					endTime: 15000,
				}),
			),
		);

		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test sub-content",
					startTime: 3000,
					endTime: 15000,
				}),
			),
		);

		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A completely different and single node",
					startTime: 16000,
					endTime: 17000,
				}),
			),
		);

		/**
		 * Test: the second node ends before "parent".
		 */

		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test master-content",
					startTime: 18000,
					endTime: 30000,
				}),
			),
		);

		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test sub-content",
					startTime: 20000,
					endTime: 23000,
				}),
			),
		);

		/**
		 * Test: first node ends after second node.
		 * If should be fetched in the correct time
		 * order
		 */

		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test sub-content",
					startTime: 36000,
					endTime: 38000,
				}),
			),
		);

		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test master-content",
					startTime: 33500,
					endTime: 38000,
				}),
			),
		);

		const query1 = tree.getCurrentNodes(7000);

		expect(query1?.length).toBe(2);
		expect(query1).toMatchObject([
			{
				id: "any",
				content: "A test master-content",
				startTime: 0,
				endTime: 15000,
			},
			{
				id: "any",
				content: "A test sub-content",
				startTime: 3000,
				endTime: 15000,
			},
		]);

		const query2 = tree.getCurrentNodes(22500);

		expect(query2?.length).toBe(2);
		expect(query2).toMatchObject([
			{
				content: "A test master-content",
				startTime: 18000,
				endTime: 30000,
			},
			{
				content: "A test sub-content",
				startTime: 20000,
				endTime: 23000,
			},
		]);

		const query3 = tree.getCurrentNodes(37000);

		expect(query3?.length).toBe(2);
		expect(query3).toMatchObject([
			{
				content: "A test master-content",
				startTime: 33500,
				endTime: 38000,
			},
			{
				content: "A test sub-content",
				startTime: 36000,
				endTime: 38000,
			},
		]);
	});

	it("should return all the nodes in the correct order", () => {
		/** Root */
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content 1",
					startTime: 11000,
					endTime: 12000,
				}),
			),
		);

		/** Adding on left */
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content 2",
					startTime: 3000,
					endTime: 10000,
				}),
			),
		);

		/** Adding on right */
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content 3",
					startTime: 12000,
					endTime: 15000,
				}),
			),
		);

		/** Adding on left's left */
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content 4",
					startTime: 0,
					endTime: 5000,
				}),
			),
		);

		/** Adding on left's right */
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content 5",
					startTime: 5000,
					endTime: 9000,
				}),
			),
		);

		/** Adding on right's left */
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content 6",
					startTime: 12000,
					endTime: 13000,
				}),
			),
		);

		/** Adding on right's right */
		tree.addNode(
			cueNodeToTreeLeaf(
				new CueNode({
					id: "any",
					content: "A test content 7",
					startTime: 13000,
					endTime: 15000,
				}),
			),
		);

		const query = tree.getAll();

		expect(query.length).toBe(7);

		/** LEFT NODES */

		expect(query[0]).toMatchObject({
			content: "A test content 4",
			startTime: 0,
			endTime: 5000,
		});

		expect(query[1]).toMatchObject({
			content: "A test content 2",
			startTime: 3000,
			endTime: 10000,
		});

		expect(query[2]).toMatchObject({
			content: "A test content 5",
			startTime: 5000,
			endTime: 9000,
		});

		/** ROOT NODE */

		expect(query[3]).toMatchObject({
			content: "A test content 1",
			startTime: 11000,
			endTime: 12000,
		});

		/** RIGHT NODES */

		expect(query[4]).toMatchObject({
			content: "A test content 3",
			startTime: 12000,
			endTime: 15000,
		});

		expect(query[5]).toMatchObject({
			content: "A test content 6",
			startTime: 12000,
			endTime: 13000,
		});

		expect(query[6]).toMatchObject({
			content: "A test content 7",
			startTime: 13000,
			endTime: 15000,
		});
	});
});

/**
 *
 * @param {CueNode} cueNode
 * @returns
 */

function cueNodeToTreeLeaf(cueNode) {
	return {
		left: null,
		right: null,
		node: cueNode,
		max: cueNode.endTime,
		get low() {
			return this.node.startTime;
		},
		get high() {
			return this.node.endTime;
		},
	};
}
