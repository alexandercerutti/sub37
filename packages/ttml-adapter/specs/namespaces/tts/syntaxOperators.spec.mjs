import { describe, expect, it } from "@jest/globals";
import {
	DerivationState,
	isDerived,
	isDone,
	isRejected,
	zeroOrOne,
	zeroOrMore,
	oneOrMore,
	sequence,
	oneOf,
	someOf,
} from "../../../lib/Parser/structure/grammar.js";

function createTokenNode(expectedToken, name = expectedToken) {
	return Object.create(null, {
		type: { value: name },
		derive: {
			value: (token) => {
				if (token === expectedToken) {
					return {
						state: DerivationState.DONE,
						values: [{ type: "token", value: token }],
					};
				}
				return {
					state: DerivationState.REJECTED,
					rejectionDetails: `expected ${expectedToken}, got ${token}`,
				};
			},
		},
	});
}

function createChainNode(expectedToken, nextNode) {
	return Object.create(null, {
		type: { value: expectedToken },
		derive: {
			value: (token) => {
				if (token === expectedToken) {
					return {
						state: DerivationState.DERIVED,
						nextNode,
						values: [{ type: "token", value: token }],
					};
				}
				return {
					state: DerivationState.REJECTED,
					rejectionDetails: `expected ${expectedToken}, got ${token}`,
				};
			},
		},
	});
}

describe("Parser Operators", () => {
	describe("zeroOrOne (?)", () => {
		it("should pass through the result when the child accepts", () => {
			const result = zeroOrOne(createTokenNode("A")).derive("A");
			expect(isDone(result)).toBe(true);
		});

		it("should return REJECTED | OPTIONAL when the child rejects", () => {
			const result = zeroOrOne(createTokenNode("A")).derive("B");
			expect(isRejected(result)).toBe(true);
			expect(result.state & DerivationState.OPTIONAL).toBeTruthy();
		});
	});

	describe("zeroOrMore (*)", () => {
		it("should return DERIVED with itself as nextNode when child is DONE", () => {
			const node = createTokenNode("A");
			const result = zeroOrMore(node).derive("A");
			expect(isDerived(result)).toBe(true);
			expect(isDerived(result.nextNode.derive("A"))).toBe(true);
		});

		it("should return REJECTED | OPTIONAL when child rejects", () => {
			const result = zeroOrMore(createTokenNode("A")).derive("B");
			expect(isRejected(result)).toBe(true);
			expect(result.state & DerivationState.OPTIONAL).toBeTruthy();
		});

		it("should chain partial matches through DERIVED paths", () => {
			const node = createChainNode("A", createTokenNode("B"));
			const loop = zeroOrMore(node);

			const afterA = loop.derive("A");
			expect(isDerived(afterA)).toBe(true);

			const afterB = afterA.nextNode.derive("B");
			expect(isDerived(afterB)).toBe(true);

			expect(isDerived(afterB.nextNode.derive("A"))).toBe(true);
		});
	});

	describe("oneOrMore (+)", () => {
		it("should return DERIVED with an optional continuation after the first match", () => {
			const result = oneOrMore(createTokenNode("A")).derive("A");
			expect(isDerived(result)).toBe(true);
			expect(result.nextNode.derive("B").state & DerivationState.OPTIONAL).toBeTruthy();
		});

		it("should return strict REJECTED (no OPTIONAL) when the first token fails", () => {
			const result = oneOrMore(createTokenNode("A")).derive("B");
			expect(isRejected(result)).toBe(true);
			expect(result.state & DerivationState.OPTIONAL).toBeFalsy();
		});
	});

	describe("sequence (&&)", () => {
		it("should advance to the next node when the head is DONE", () => {
			const seq = sequence([createTokenNode("A"), createTokenNode("B")]);
			const afterA = seq.derive("A");
			expect(isDerived(afterA)).toBe(true);
			expect(isDone(afterA.nextNode.derive("B"))).toBe(true);
		});

		it("should skip an optional head that rejects and try the tail", () => {
			const seq = sequence([zeroOrOne(createTokenNode("A")), createTokenNode("B")]);
			expect(isDone(seq.derive("B"))).toBe(true);
		});

		it("should return REJECTED when all optionals are skipped and no tail remains", () => {
			const seq = sequence([zeroOrOne(createTokenNode("A"))]);
			expect(isRejected(seq.derive("B"))).toBe(true);
		});

		it("should include undefined in values when an optional head is skipped", () => {
			const seq = sequence([zeroOrOne(createTokenNode("A")), createTokenNode("B")]);
			const result = seq.derive("B");
			expect(isDone(result)).toBe(true);
			expect(result.values).toHaveLength(2);
			expect(result.values[0]).toBeUndefined();
			expect(result.values[1]).toEqual({ type: "token", value: "B" });
		});

		it("should accumulate one undefined per skipped optional", () => {
			const seq = sequence([
				zeroOrOne(createTokenNode("A")),
				zeroOrOne(createTokenNode("B")),
				createTokenNode("C"),
			]);
			const result = seq.derive("C");
			expect(isDone(result)).toBe(true);
			expect(result.values).toHaveLength(3);
			expect(result.values[0]).toBeUndefined();
			expect(result.values[1]).toBeUndefined();
			expect(result.values[2]).toEqual({ type: "token", value: "C" });
		});
	});

	describe("oneOf (|)", () => {
		it("should return DONE when one path matches and finishes", () => {
			const result = oneOf([createTokenNode("A"), createTokenNode("B")]).derive("A");
			expect(isDone(result)).toBe(true);
		});

		it("should return DERIVED when the matching path needs more input", () => {
			const choice = oneOf([createChainNode("A", createTokenNode("B")), createTokenNode("C")]);
			const afterA = choice.derive("A");
			expect(isDerived(afterA)).toBe(true);
			expect(isDone(afterA.nextNode.derive("B"))).toBe(true);
		});

		it("should keep both DERIVED paths alive when they share a prefix", () => {
			const choice = oneOf([
				createChainNode("A", createTokenNode("B")),
				createChainNode("A", createTokenNode("C")),
			]);
			const afterA = choice.derive("A");
			expect(isDerived(afterA)).toBe(true);
			expect(isDone(afterA.nextNode.derive("B"))).toBe(true);
			expect(isDone(afterA.nextNode.derive("C"))).toBe(true);
		});

		it("should mark the continuation optional when one path is already DONE", () => {
			const choice = oneOf([createTokenNode("A"), createChainNode("A", createTokenNode("B"))]);
			const afterA = choice.derive("A");
			expect(isDerived(afterA)).toBe(true);
			// stopping here is valid — extra input is optionally rejected
			expect(afterA.nextNode.derive("X").state & DerivationState.OPTIONAL).toBeTruthy();
			// but B is still accepted
			expect(isDone(afterA.nextNode.derive("B"))).toBe(true);
		});
	});

	describe("someOf (||)", () => {
		it("should accept any single item from the set as the first token", () => {
			const set = someOf([createTokenNode("A"), createTokenNode("B"), createTokenNode("C")]);
			expect(isDerived(set.derive("A"))).toBe(true);
			expect(isDerived(set.derive("B"))).toBe(true);
			expect(isDerived(set.derive("C"))).toBe(true);
		});

		it("should make the remaining items optional after the first match", () => {
			const result = someOf([createTokenNode("A"), createTokenNode("B")]).derive("A");
			expect(isDerived(result)).toBe(true);
			expect(result.nextNode.derive("X").state & DerivationState.OPTIONAL).toBeTruthy();
		});

		it("should accept remaining items in any order after the first match", () => {
			const set = someOf([createTokenNode("A"), createTokenNode("B"), createTokenNode("C")]);

			// A → C → B
			const afterA = set.derive("A").nextNode;
			const afterC = afterA.derive("C").nextNode;
			expect(isRejected(afterC.derive("B"))).toBe(false);

			// B → A → C
			const afterB = set.derive("B").nextNode;
			const afterA2 = afterB.derive("A").nextNode;
			expect(isRejected(afterA2.derive("C"))).toBe(false);
		});

		it("should return strict REJECTED (no OPTIONAL) when no item matches", () => {
			const result = someOf([createTokenNode("A"), createTokenNode("B")]).derive("X");
			expect(isRejected(result)).toBe(true);
			expect(result.state & DerivationState.OPTIONAL).toBeFalsy();
		});
	});
});
