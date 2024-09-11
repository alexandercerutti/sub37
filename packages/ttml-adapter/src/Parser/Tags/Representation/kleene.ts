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
				const matches = nodeName === node.nodeName;
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
				const matches = nodeName === node.nodeName;

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

				const matches = nodeName === node.nodeName;
				this[usagesSymbol] += Number(matches);

				return matches;
			},
		},
	});
}

export function or(...nodes: NodeRepresentation<string>[]): KleeneNodeRepresentation<"|"> {
	return {
		[operatorSymbol]: "|",
		[usagesSymbol]: 0,
		nodeName: "collector",
		destinationFactory: () => [],
		matches(nodeName: string) {
			return nodes.some((node) => node.matches(nodeName));
		},
	};
}
