// @ts-check

import { describe, it, expect, beforeEach } from "@jest/globals";
import { TrackingTree } from "../lib/Parser/Tags/TrackingTree.js";

describe("TrackingTree", () => {
	/**
	 * @type {TrackingTree<object>}
	 */

	let tree;

	beforeEach(() => {
		tree = new TrackingTree();
	});

	it("should pop only when the parent element is untracked", () => {
		tree.addUntrackedNode({
			untr: 1,
		});

		tree.addTrackedNode({
			trk: 1,
		});

		tree.addTrackedNode({
			trk: 2,
		});

		expect(tree.pop()).toBeNull();
		expect(tree.pop()).toMatchObject({
			parent: {
				content: {
					untr: 1,
				},
			},
			content: {
				trk: 1,
			},
			children: [
				{
					content: {
						trk: 2,
					},
					parent: {
						content: {
							trk: 1,
						},
					},
				},
			],
		});
	});
});
