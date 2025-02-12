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
				let matches = nodeName === node.nodeName;

				if (
					!matches &&
					(node as KleeneNodeRepresentation<KleeneOperationSymbols>)[operatorSymbol]
				) {
					matches = node.matches(nodeName);
				}

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
				let matches = nodeName === node.nodeName;

				if (
					!matches &&
					(node as KleeneNodeRepresentation<KleeneOperationSymbols>)[operatorSymbol]
				) {
					// Delegating to the inner operator
					matches = node.matches(nodeName);
				}

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

				let matches = nodeName === node.nodeName;

				if (
					!matches &&
					(node as KleeneNodeRepresentation<KleeneOperationSymbols>)[operatorSymbol]
				) {
					// Delegating to the inner operator
					matches = node.matches(nodeName);
				}

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
		nodeName: "collector",
		destinationFactory: () => matchedNode?.destinationFactory() ?? [],
		matches(nodeName: string) {
			matchedNode = nodes.find((node) => node.matches(nodeName));
			return Boolean(matchedNode);
		},
	};
}
