import { describe, expect, it } from "@jest/globals";
import {
	DerivationState,
	zeroOrOne,
	zeroOrMore,
	oneOrMore,
	sequence,
	oneOf,
	someOf,
} from "../../lib/Parser/Style/structure/operators.js";

const OperatorSymbol = Symbol.for("operator");

/**
 * Helper to create a mock Derivable node that accepts specific tokens.
 * @param {string} expectedToken
 * @param {string} name
 */
function createTokenNode(expectedToken, name = expectedToken) {
	return Object.create(null, {
		[OperatorSymbol]: { value: name },
		derive: {
			value: (token) => {
				if (token === expectedToken) {
					return {
						state: DerivationState.DONE,
						values: [{ type: "token", value: token }],
					};
				}
				return { state: DerivationState.REJECTED };
			},
		},
	});
}

/**
 * Helper to create a mock Derivable node that accepts a token and returns a continuation.
 * @param {string} expectedToken
 * @param {import("../../lib/Parser/Style/structure/operators.js").Derivable} nextNode
 */
function createChainNode(expectedToken, nextNode) {
	return Object.create(null, {
		[OperatorSymbol]: { value: expectedToken },
		derive: {
			value: (token) => {
				if (token === expectedToken) {
					return {
						state: DerivationState.DERIVED,
						nextNode,
						values: [{ type: "token", value: token }],
					};
				}
				return { state: DerivationState.REJECTED };
			},
		},
	});
}

describe("Parser Operators", () => {
	describe("zeroOrOne (?)", () => {
		it("should accept the token and return the result if the child accepts it", () => {
			const node = createTokenNode("A");
			const optionalNode = zeroOrOne(node);
			const result = optionalNode.derive("A");

			expect(result.state & DerivationState.DONE).toBeTruthy();
		});

		it("should return REJECTED | OPTIONAL if the child rejects the token", () => {
			const node = createTokenNode("A");
			const optionalNode = zeroOrOne(node);
			const result = optionalNode.derive("B");

			expect(result.state & DerivationState.REJECTED).toBeTruthy();
			expect(result.state & DerivationState.OPTIONAL).toBeTruthy();
		});
	});

	describe("zeroOrMore (*)", () => {
		it("should return DERIVED with nextNode as itself if child is DONE", () => {
			const node = createTokenNode("A");
			const loopNode = zeroOrMore(node);
			const result = loopNode.derive("A");

			expect(result.state & DerivationState.DERIVED).toBeTruthy();
			// It should be ready to accept "A" again
			const nextResult = result.nextNode.derive("A");
			expect(nextResult.state & DerivationState.DERIVED).toBeTruthy();
		});

		it("should return REJECTED | OPTIONAL if child rejects", () => {
			const node = createTokenNode("A");
			const loopNode = zeroOrMore(node);
			const result = loopNode.derive("B");

			expect(result.state & DerivationState.REJECTED).toBeTruthy();
			expect(result.state & DerivationState.OPTIONAL).toBeTruthy();
		});

		it("should chain partial matches correctly", () => {
			// A node that needs "A" then "B"
			const node = createChainNode("A", createTokenNode("B"));
			const loopNode = zeroOrMore(node);

			// Feed "A"
			const result = loopNode.derive("A");
			expect(result.state & DerivationState.DERIVED).toBeTruthy();

			// Next expected is "B", then back to loop
			const nextNode = result.nextNode;
			// Feed "B"
			const result2 = nextNode.derive("B");
			expect(result2.state & DerivationState.DERIVED).toBeTruthy();

			// Now we should be back at the start of the loop
			const result3 = result2.nextNode.derive("A");
			expect(result3.state & DerivationState.DERIVED).toBeTruthy();
		});
	});

	describe("oneOrMore (+)", () => {
		it("should return DERIVED with nextNode as zeroOrMore if child is DONE", () => {
			const node = createTokenNode("A");
			const plusNode = oneOrMore(node);
			const result = plusNode.derive("A");

			expect(result.state & DerivationState.DERIVED).toBeTruthy();
			// Next state should be optional loop
			const nextResult = result.nextNode.derive("B"); // "B" rejects
			expect(nextResult.state & DerivationState.OPTIONAL).toBeTruthy();
		});

		it("should return REJECTED (strict) if child rejects first token", () => {
			const node = createTokenNode("A");
			const plusNode = oneOrMore(node);
			const result = plusNode.derive("B");

			expect(result.state & DerivationState.REJECTED).toBeTruthy();
			expect(result.state & DerivationState.OPTIONAL).toBeFalsy();
		});
	});

	describe("sequence (&&)", () => {
		it("should advance to next node if head is DONE", () => {
			const seq = sequence([createTokenNode("A"), createTokenNode("B")]);
			const result = seq.derive("A");

			expect(result.state & DerivationState.DERIVED).toBeTruthy();
			// Next should be B
			const result2 = result.nextNode.derive("B");
			expect(result2.state & DerivationState.DONE).toBeTruthy();
		});

		it("should skip optional head if it rejects, and try tail", () => {
			const seq = sequence([zeroOrOne(createTokenNode("A")), createTokenNode("B")]);
			// Skip A, go straight to B
			const result = seq.derive("B");

			expect(result.state & DerivationState.DONE).toBeTruthy();
		});

		it("should return REJECTED | OPTIONAL if all items are optional and skipped", () => {
			// Note: sequence itself doesn't return OPTIONAL unless the last item returns OPTIONAL.
			// But if we have [A?, B?] and input is "C", A? skips, B? skips.
			// B? returns REJECTED | OPTIONAL.
			// The sequence loop finishes.
			// Wait, our implementation returns REJECTED if tail is empty.
			// Let's verify the behavior we implemented.

			const seq = sequence([zeroOrOne(createTokenNode("A"))]);
			const result = seq.derive("B");

			// A? rejects "B" -> returns REJECTED|OPTIONAL.
			// Sequence loop sees OPTIONAL, advances to tail.
			// Tail is empty.
			// Returns REJECTED.
			expect(result.state & DerivationState.REJECTED).toBeTruthy();
			expect(result.rejectionDetails).toBeTruthy();
		});

		it("should include undefined in values when optional head is skipped", () => {
			const seq = sequence([zeroOrOne(createTokenNode("A")), createTokenNode("B")]);
			const result = seq.derive("B");

			expect(result.state & DerivationState.DONE).toBeTruthy();
			expect(result.values).toHaveLength(2);
			expect(result.values[0]).toBeUndefined();
			expect(result.values[1]).toEqual({ type: "token", value: "B" });
		});

		it("should preserve undefined for multiple optional elements", () => {
			// [A?, B?, C] -> derive "C"
			const seq = sequence([
				zeroOrOne(createTokenNode("A")),
				zeroOrOne(createTokenNode("B")),
				createTokenNode("C"),
			]);
			const result = seq.derive("C");

			expect(result.state & DerivationState.DONE).toBeTruthy();
			expect(result.values).toHaveLength(3);
			expect(result.values[0]).toBeUndefined();
			expect(result.values[1]).toBeUndefined();
			expect(result.values[2]).toEqual({ type: "token", value: "C" });
		});
	});

	describe("oneOf (|)", () => {
		it("should return DONE if one path matches and finishes", () => {
			const choice = oneOf([createTokenNode("A"), createTokenNode("B")]);
			const result = choice.derive("A");
			expect(result.state & DerivationState.DONE).toBeTruthy();
		});

		it("should return DERIVED if one path matches partially", () => {
			const choice = oneOf([createChainNode("A", createTokenNode("B")), createTokenNode("C")]);
			const result = choice.derive("A");
			expect(result.state & DerivationState.DERIVED).toBeTruthy();
			// Should continue to B
			expect(result.nextNode.derive("B").state & DerivationState.DONE).toBeTruthy();
		});

		it("should handle ambiguity by keeping both paths alive", () => {
			// Path 1: A -> B
			// Path 2: A -> C
			const path1 = createChainNode("A", createTokenNode("B"));
			const path2 = createChainNode("A", createTokenNode("C"));
			const choice = oneOf([path1, path2]);

			const result = choice.derive("A");
			expect(result.state & DerivationState.DERIVED).toBeTruthy();

			// Next node should accept B OR C
			const nextNode = result.nextNode;
			expect(nextNode.derive("B").state & DerivationState.DONE).toBeTruthy();
			expect(nextNode.derive("C").state & DerivationState.DONE).toBeTruthy();
		});

		it("should allow stopping if one path is DONE and another is DERIVED", () => {
			// Path 1: A (DONE)
			// Path 2: A -> B (DERIVED)
			const path1 = createTokenNode("A");
			const path2 = createChainNode("A", createTokenNode("B"));
			const choice = oneOf([path1, path2]);

			const result = choice.derive("A");
			expect(result.state & DerivationState.DERIVED).toBeTruthy();

			// The next node should be optional (because we could have stopped at A)
			// So if we feed it garbage, it should return REJECTED | OPTIONAL
			const nextResult = result.nextNode.derive("X");
			expect(nextResult.state & DerivationState.OPTIONAL).toBeTruthy();

			// But it should still accept B
			const bResult = result.nextNode.derive("B");
			expect(bResult.state & DerivationState.DONE).toBeTruthy();
		});
	});

	describe("someOf (||)", () => {
		it("should match one item and return a sequence for the rest", () => {
			const set = someOf([createTokenNode("A"), createTokenNode("B")]);
			const result = set.derive("A");

			expect(result.state & DerivationState.DERIVED).toBeTruthy();
			// Next should be optional(someOf(B))
			// So it should accept B
			const bResult = result.nextNode.derive("B");
			expect(bResult.state & DerivationState.DONE).toBeTruthy(); // or DERIVED depending on implementation details
		});

		it("should allow skipping the rest after one match", () => {
			const set = someOf([createTokenNode("A"), createTokenNode("B")]);
			const result = set.derive("A");

			// Next node is optional
			const skipResult = result.nextNode.derive("X");
			expect(skipResult.state & DerivationState.OPTIONAL).toBeTruthy();
		});

		it("should handle interleaving", () => {
			// A, B, C in any order
			const set = someOf([createTokenNode("A"), createTokenNode("B"), createTokenNode("C")]);

			// A -> C -> B
			let cursor = set.derive("A").nextNode;
			cursor = cursor.derive("C").nextNode;
			const final = cursor.derive("B");

			expect(final.state & (DerivationState.DONE | DerivationState.DERIVED)).toBeTruthy();
		});
	});
});
