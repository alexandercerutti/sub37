import { describe, it, expect, beforeEach } from "@jest/globals";
import { createVisitor } from "../lib/Parser/Tags/Representation/visitor.js";
import { createNode } from "../lib/Parser/Tags/Representation/NodeRepresentation.js";
import * as Kleene from "../lib/Parser/Tags/Representation/kleene.js";

describe("Visitor", () => {
	it("should return the first node that matches", () => {
		const visitor = createVisitor(
			createNode(null, [], () => [
				Kleene.zeroOrOne(createNode("test1")),
				Kleene.oneOrMore(createNode("test2")),
			]),
		);

		expect(visitor.match("test2")).not.toBeNull();
		expect(visitor.match("test1")).toBeNull();
		expect(visitor.match("test2")).not.toBeNull();
		expect(visitor.match("test2")).not.toBeNull();
	});

	it("should navigate to the next node and perform a match check on it's destinations and back", () => {
		const visitor = createVisitor(
			createNode(null, [], () => [
				Kleene.zeroOrOne(createNode("test1")),
				Kleene.oneOrMore(createNode("test2", [], () => [Kleene.oneOrMore(createNode("test3"))])),
				Kleene.oneOrMore(createNode("test4", [], () => [Kleene.zeroOrOne(createNode("test4"))])),
			]),
		);

		const dest = visitor.match("test2");
		visitor.navigate(dest);

		expect(visitor.match("test3")).not.toBeNull();

		visitor.back();

		const dest1 = visitor.match("test4");
		expect(dest1).not.toBeNull();

		visitor.navigate(dest1);

		expect(visitor.match("test4")).not.toBeNull();
	});
});
