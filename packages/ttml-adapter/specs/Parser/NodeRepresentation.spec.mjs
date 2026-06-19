import { describe, it, expect } from "@jest/globals";
import { createNode } from "../../lib/Parser/Tags/NodeRepresentation.js";
import {
	oneOf,
	sequence,
	zeroOrMore,
	zeroOrOne,
	isDone,
	isDerived,
	isRejected,
} from "../../lib/Parser/structure/grammar.js";

describe("createNode as Derivable", () => {
	describe("derive()", () => {
		it("should return REJECTED when the element name does not match", () => {
			const node = createNode("body");
			const result = node.derive("head");
			expect(isRejected(result)).toBe(true);
		});

		it("should return DONE when the element name matches and no factory is provided", () => {
			const node = createNode("style");
			const result = node.derive("style");
			expect(isDone(result)).toBe(true);
		});

		it("should return DONE when the element name matches and the factory returns empty", () => {
			const node = createNode("initial", new Set(), () => null);
			const result = node.derive("initial");
			expect(isDone(result)).toBe(true);
		});

		it("should return DERIVED when the element name matches and the factory returns a Derivable", () => {
			const node = createNode("body", new Set(), () => zeroOrMore(createNode("div")));
			const result = node.derive("body");
			expect(isDerived(result)).toBe(true);
		});

		it("should return DERIVED with nextNode being the factory's Derivable", () => {
			const childGrammar = zeroOrMore(createNode("div"));
			const node = createNode("body", new Set(), () => childGrammar);
			const result = node.derive("body");

			expect(isDerived(result)).toBe(true);

			if (isDerived(result)) {
				/*
				 * Deriving "div" from the child grammar should succeed,
				 * proving nextNode is the correct grammar for children.
				 */
				expect(isRejected(result.nextNode.derive("div"))).toBe(false);
			}
		});

		it("should carry matchesAttribute in the DerivedValue for attribute validation", () => {
			const node = createNode("region", new Set(["xml:id", "tts:*"]), () =>
				zeroOrMore(createNode("style")),
			);
			const result = node.derive("region");

			expect(isDerived(result)).toBe(true);

			if (isDerived(result)) {
				const [value] = result.values;
				expect(value).not.toBeUndefined();
				expect(value.value.matchesAttribute("xml:id")).toBe(true);
				expect(value.value.matchesAttribute("tts:color")).toBe(true);
				expect(value.value.matchesAttribute("unknown")).toBe(false);
			}
		});

		it("should carry matchesAttribute in the DerivedValue for DONE results too", () => {
			const node = createNode("style", new Set(["xml:id"]));
			const result = node.derive("style");

			expect(isDone(result)).toBe(true);

			if (isDone(result)) {
				const [value] = result.values;
				expect(value.value.matchesAttribute("xml:id")).toBe(true);
			}
		});
	});

	describe("self-referencing nodes via let binding", () => {
		it("should support a node that can contain itself via late binding", () => {
			/*
			 * This replaces `withSelfReference`. The let binding closes over
			 * divNode before it is assigned; by the time derive() is called
			 * (and thus the factory is invoked), the assignment has happened.
			 */
			let divNode;
			divNode = createNode("div", new Set(), () => zeroOrMore(divNode));

			const result = divNode.derive("div");
			expect(isDerived(result)).toBe(true);

			if (isDerived(result)) {
				/*
				 * The child grammar should also accept "div" — proving
				 * the recursion is wired correctly.
				 */
				const nested = result.nextNode.derive("div");
				expect(isRejected(nested)).toBe(false);
			}
		});
	});

	describe("composition with operators", () => {
		it("should compose with oneOf to express alternatives", () => {
			const AnimationClass = () => oneOf([createNode("animate"), createNode("set")]);

			const animationNode = AnimationClass();

			expect(isRejected(animationNode.derive("animate"))).toBe(false);
			expect(isRejected(animationNode.derive("set"))).toBe(false);
			expect(isRejected(animationNode.derive("div"))).toBe(true);
		});

		it("should compose with sequence to express ordered siblings", () => {
			const headChildren = sequence([
				zeroOrOne(createNode("styling")),
				zeroOrOne(createNode("layout")),
			]);

			/*
			 * "styling" at position 0 should derive successfully.
			 */
			const r1 = headChildren.derive("styling");
			expect(isRejected(r1)).toBe(false);
		});

		it("should compose with zeroOrMore inside a factory for repeating children", () => {
			const styling = createNode("styling", new Set(), () => zeroOrMore(createNode("style")));

			const result = styling.derive("styling");
			expect(isDerived(result)).toBe(true);

			if (isDerived(result)) {
				/*
				 * The children grammar should accept "style" repeatedly.
				 */
				expect(isRejected(result.nextNode.derive("style"))).toBe(false);
				expect(isRejected(result.nextNode.derive("style"))).toBe(false);
			}
		});
	});
});
