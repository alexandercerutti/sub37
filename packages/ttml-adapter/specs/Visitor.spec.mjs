import { describe, it, expect } from "@jest/globals";
import { createVisitor } from "../lib/Parser/structure/visitor.js";
import { createNode } from "../lib/Parser/Tags/Representation/NodeRepresentation.js";
import * as Kleene from "../lib/Parser/structure/kleene.js";

/**
 * @typedef {import("../lib/Parser/Tags/Representation/NodeRepresentation.js").NodeRepresentation<string>} NodeRepresentation
 */

describe("Visitor", () => {
	it("should return a matching node", () => {
		const visitor = createVisitor(
			createNode(null, new Set(), () => [
				Kleene.zeroOrOne(/** @type {NodeRepresentation} */ (createNode("test1"))),
				Kleene.oneOrMore(createNode("test2")),
			]),
		);

		expect(visitor.match("test2")).not.toBeNull();
	});

	it("should not match a node that comes before an already-matched node (ordered grammar)", () => {
		/**
		 * Destinations: [zeroOrOne("test1"), oneOrMore("test2")]
		 *
		 * Once "test2" (index 1) has been matched, "test1" (index 0) must
		 * not be matchable anymore. The visitor should track a cursor that
		 * only moves forward, not reset to 0 on each call.
		 *
		 * THIS TEST CURRENTLY FAILS — the cursor resets to 0 every call.
		 */
		const visitor = createVisitor(
			createNode(null, new Set(), () => [
				Kleene.zeroOrOne(/** @type {NodeRepresentation} */ (createNode("test1"))),
				Kleene.oneOrMore(createNode("test2")),
			]),
		);

		visitor.match("test2");
		expect(visitor.match("test1")).toBeNull();
	});

	it("should match oneOrMore nodes repeatedly", () => {
		const visitor = createVisitor(
			createNode(null, new Set(), () => [Kleene.oneOrMore(createNode("test2"))]),
		);

		expect(visitor.match("test2")).not.toBeNull();
		expect(visitor.match("test2")).not.toBeNull();
		expect(visitor.match("test2")).not.toBeNull();
	});

	it("should navigate into child nodes by creating a child visitor from the matched node", () => {
		/**
		 * Navigation is the caller's responsibility now:
		 * pass the matched destination to createVisitor() to get a
		 * visitor scoped to that node's children.
		 */
		const parent = createVisitor(
			createNode(null, new Set(), () => [
				Kleene.oneOrMore(
					createNode("test2", new Set(), () => [Kleene.oneOrMore(createNode("test3"))]),
				),
			]),
		);

		const matched = parent.match("test2");
		expect(matched).not.toBeNull();

		const child = createVisitor(matched);
		expect(child.match("test3")).not.toBeNull();
	});
});
