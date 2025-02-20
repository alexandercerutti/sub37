import { MinimumElementViolationError } from "./MinimumElementViolationError";
import type { NodeRepresentation } from "./NodeRepresentation";

const operatorSymbol = Symbol("kleene.operator");
const usagesSymbol = Symbol("kleene.counter");

type KleeneOperationSymbols = "*" | "?" | "+" | "|";

interface KleeneOperator<Op extends KleeneOperationSymbols> {
	[operatorSymbol]: Op;
	[usagesSymbol]: number;

	matches(nodeName: string): boolean;
}

type KleeneNodeRepresentation<Op extends "*" | "?" | "+" | "|"> = KleeneOperator<Op> &
	NodeRepresentation<string>;

export function zeroOrMore(node: NodeRepresentation<string>): KleeneNodeRepresentation<"*"> {
	return Object.create(node, {
		[operatorSymbol]: {
			value: "*",
		},
		[usagesSymbol]: {
			value: 0,
			writable: true,
		},
		matches: {
			value(this: KleeneOperator<"*">, nodeName: string) {
				const matches = node.matches(nodeName);

				this[usagesSymbol] += Number(matches);

				return matches;
			},
		},
	});
}

export function oneOrMore(node: NodeRepresentation<string>): KleeneNodeRepresentation<"+"> {
	return Object.create(node, {
		[operatorSymbol]: {
			value: "+",
		},
		[usagesSymbol]: {
			value: 0,
			writable: true,
		},
		matches: {
			value(this: KleeneOperator<"+">, nodeName: string) {
				const matches = node.matches(nodeName);

				if (this[usagesSymbol] < 1 && !matches) {
					throw new MinimumElementViolationError(node.nodeName);
				}

				this[usagesSymbol] += Number(matches);

				return matches;
			},
		},
	});
}

export function zeroOrOne(node: NodeRepresentation<string>): KleeneNodeRepresentation<"?"> {
	return Object.create(node, {
		[operatorSymbol]: {
			value: "?",
		},
		[usagesSymbol]: {
			value: 0,
			writable: true,
		},
		matches: {
			value(this: KleeneOperator<"?">, nodeName: string) {
				if (this[usagesSymbol] > 0) {
					return false;
				}

				const matches = node.matches(nodeName);

				this[usagesSymbol] += Number(matches);

				return matches;
			},
		},
	});
}

export function or(...nodes: NodeRepresentation<string>[]): KleeneNodeRepresentation<"|"> {
	let matchedNode: NodeRepresentation<string> | undefined;

	return {
		[operatorSymbol]: "|",
		[usagesSymbol]: 0,
		get nodeName(): string {
			if (!matchedNode) {
				throw new Error(
					"Cannot get nodeName when a node has not been matched yet through an or operator",
				);
			}

			return matchedNode.nodeName;
		},
		destinationFactory: () => {
			if (!matchedNode) {
				throw new Error(
					"Cannot get destinations when a node has not been matched yet through an or operator",
				);
			}

			return matchedNode?.destinationFactory() ?? [];
		},
		matches(nodeName: string): boolean {
			matchedNode = nodes.find((node) => node.matches(nodeName));
			return Boolean(matchedNode);
		},
		matchesAttribute(attribute): boolean {
			if (!matchedNode) {
				throw new Error("Cannot match when a node has not been matched yet.");
			}

			return matchedNode.matchesAttribute(attribute);
		},
	};
}
