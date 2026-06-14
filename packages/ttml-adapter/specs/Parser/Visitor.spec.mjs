import { describe, it, expect } from "@jest/globals";
import { createVisitor } from "../../lib/Parser/Tags/visitor.js";
import { createNode } from "../../lib/Parser/Tags/NodeRepresentation.js";
import { zeroOrOne, oneOrMore, sequence } from "../../lib/Parser/structure/grammar.js";

describe("Visitor", () => {
	it("should return null when grammar is null", () => {
		const visitor = createVisitor(null);
		expect(visitor.match("anything")).toBeNull();
	});

	it("should return null when grammar is undefined", () => {
		const visitor = createVisitor(undefined);
		expect(visitor.match("anything")).toBeNull();
	});

	it("should return a MatchResult for a matching node", () => {
		const grammar = zeroOrOne(createNode("div", new Set(["id"])));
		const visitor = createVisitor(grammar);

		const result = visitor.match("div");
		expect(result).not.toBeNull();
	});

	it("should return null for a non-matching node", () => {
		const grammar = zeroOrOne(createNode("div"));
		const visitor = createVisitor(grammar);

		expect(visitor.match("span")).toBeNull();
	});

	it("should expose matchesAttribute on the MatchResult", () => {
		const grammar = zeroOrOne(createNode("div", new Set(["id", "class"])));
		const visitor = createVisitor(grammar);

		const result = visitor.match("div");
		expect(result.matchesAttribute("id")).toBe(true);
		expect(result.matchesAttribute("class")).toBe(true);
		expect(result.matchesAttribute("data-x")).toBe(false);
	});

	it("should return null when matching children of a leaf node", () => {
		const grammar = zeroOrOne(createNode("br"));
		const visitor = createVisitor(grammar);

		const result = visitor.match("br");
		expect(result.match("anything")).toBeNull();
	});

	it("should expose children grammar for a node with children", () => {
		const grammar = zeroOrOne(createNode("div", new Set(), () => oneOrMore(createNode("p"))));
		const visitor = createVisitor(grammar);

		const result = visitor.match("div");
		expect(result.match("p")).not.toBeNull();
	});

	it("should allow navigating into children", () => {
		const grammar = zeroOrOne(createNode("div", new Set(), () => oneOrMore(createNode("p"))));
		const parent = createVisitor(grammar);
		const divMatch = parent.match("div");

		expect(divMatch.match("p")).not.toBeNull();
	});

	it("should match oneOrMore nodes with a fresh visitor each time", () => {
		/* Each call to createVisitor produces a stateless visitor.
		 * Repeat-matching is expressed by creating the same visitor multiple times. */
		const grammar = oneOrMore(createNode("span"));

		expect(createVisitor(grammar).match("span")).not.toBeNull();
		expect(createVisitor(grammar).match("span")).not.toBeNull();
		expect(createVisitor(grammar).match("span")).not.toBeNull();
	});

	it("should support self-referential grammars", () => {
		const divNode = createNode("div", new Set(), () => zeroOrOne(divNode));

		const grammar = zeroOrOne(divNode);
		const visitor = createVisitor(grammar);

		const outerMatch = visitor.match("div");
		expect(outerMatch).not.toBeNull();

		expect(outerMatch.match("div")).not.toBeNull();
	});

	it("should support sequence grammars", () => {
		const grammar = zeroOrOne(
			createNode("tt", new Set(), () => sequence([createNode("body"), createNode("head")])),
		);

		const visitor = createVisitor(grammar);
		const ttMatch = visitor.match("tt");
		expect(ttMatch).not.toBeNull();

		expect(ttMatch.match("body")).not.toBeNull();
	});
});
