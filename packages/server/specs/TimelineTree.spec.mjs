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

		/**
		 * Test: first node ends after second node.
		 * If should be fetched in the correct time
		 * order
		 */

		tree.addNode({
			content: "A test sub-content",
			startTime: 36000,
			endTime: 38000,
		});

		tree.addNode({
			content: "A test master-content",
			startTime: 33500,
			endTime: 38000,
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

		const query3 = tree.getCurrentNodes(37000);

		expect(query3.length).toBe(2);
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
		tree.addNode({
			content: "A test content",
			startTime: 11000,
			endTime: 12000,
		});

		/** Adding on left */
		tree.addNode({
			content: "A test content",
			startTime: 3000,
			endTime: 10000,
		});

		/** Adding on right */
		tree.addNode({
			content: "A test content",
			startTime: 12000,
			endTime: 15000,
		});

		/** Adding on left's left */
		tree.addNode({
			content: "A test content",
			startTime: 0,
			endTime: 5000,
		});

		/** Adding on left's right */
		tree.addNode({
			content: "A test content",
			startTime: 5000,
			endTime: 9000,
		});

		/** Adding on right's left */
		tree.addNode({
			content: "A test content",
			startTime: 12000,
			endTime: 13000,
		});

		/** Adding on right's right */
		tree.addNode({
			content: "A test content",
			startTime: 13000,
			endTime: 15000,
		});

		const query = tree.getAll();

		expect(query.length).toBe(7);

		expect(query).toEqual([
			// left
			{
				content: "A test content",
				startTime: 0,
				endTime: 5000,
			},
			{
				content: "A test content",
				startTime: 3000,
				endTime: 10000,
			},
			{
				content: "A test content",
				startTime: 5000,
				endTime: 9000,
			},
			// Root
			{
				content: "A test content",
				startTime: 11000,
				endTime: 12000,
			},
			// right
			{
				content: "A test content",
				startTime: 12000,
				endTime: 13000,
			},
			{
				content: "A test content",
				startTime: 12000,
				endTime: 15000,
			},
			{
				content: "A test content",
				startTime: 13000,
				endTime: 15000,
			},
		]);
	});
});
