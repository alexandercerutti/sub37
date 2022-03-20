// @ts-check
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { TimelineTree } from "../lib/TimelineTree.js";

describe("TimelineTree", () => {
	/** @type {TimelineTree} */
	let tree;

	beforeEach(() => {
		tree = new TimelineTree();
	});

	it("should assign nodes to the correct timeframe", () => {
		tree.addNode({
			content: "A test content",
			startTime: 11000,
			endTime: 12000,
		});

		tree.addNode({
			content: "A test content",
			startTime: 0,
			endTime: 10000,
		});

		const query1 = tree.getCurrentNodes(0);

		expect(query1.length).toBe(1);
		expect(query1[0]).toMatchObject({
			content: "A test content",
			startTime: 0,
			endTime: 10000,
		});

		const query2 = tree.getCurrentNodes(11500);

		expect(query2.length).toBe(1);
		expect(query2[0]).toMatchObject({
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
		tree.addNode({
			content: "A test master-content",
			startTime: 0,
			endTime: 15000,
		});

		tree.addNode({
			content: "A test sub-content",
			startTime: 3000,
			endTime: 15000,
		});

		tree.addNode({
			content: "A completely different and single node",
			startTime: 16000,
			endTime: 17000,
		});

		/**
		 * Test: the second node ends before "parent".
		 */

		tree.addNode({
			content: "A test master-content",
			startTime: 18000,
			endTime: 30000,
		});

		tree.addNode({
			content: "A test sub-content",
			startTime: 20000,
			endTime: 23000,
		});

		const query1 = tree.getCurrentNodes(7000);

		expect(query1.length).toBe(2);
		expect(query1).toMatchObject([
			{
				content: "A test master-content",
				startTime: 0,
				endTime: 15000,
			},
			{
				content: "A test sub-content",
				startTime: 3000,
				endTime: 15000,
			},
		]);

		const query2 = tree.getCurrentNodes(22500);

		expect(query2.length).toBe(2);
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
	});
});
