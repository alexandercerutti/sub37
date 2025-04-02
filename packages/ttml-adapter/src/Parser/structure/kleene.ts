import { MinimumElementViolationError } from "./MinimumElementViolationError";

const operatorSymbol = Symbol("kleene.operator");
const usagesSymbol = Symbol("kleene.counter");

type KleeneOperationSymbols = "*" | "?" | "+" | "|";
type OperationSymbols = KleeneOperationSymbols | "&";

export type DestinationFactory<T extends Matchable = Matchable> = () => T[];

interface MatchableNode {
	nodeName: string;
	matches(nodeName: string): unknown;
}

export type Matchable<T extends MatchableNode = MatchableNode> = T &
	MatchableNode & {
		destinationFactory: DestinationFactory<Matchable<MatchableNode>>;
	};

interface KleeneMatchable<Op extends OperationSymbols> extends Matchable {
	[operatorSymbol]: Op;
	[usagesSymbol]: number;
}

export function zeroOrMore<const T extends Matchable>(node: T): T & KleeneMatchable<"*"> {
	return Object.create(node, {
		[operatorSymbol]: {
			value: "*",
		},
		[usagesSymbol]: {
			value: 0,
			writable: true,
		},
		matches: {
			value(this: KleeneMatchable<"*">, nodeName: string) {
				const matches = node.matches(nodeName);

				this[usagesSymbol] += Number(matches);

				return matches;
			},
		},
	});
}

export function oneOrMore<const T extends Matchable>(node: T): T & KleeneMatchable<"+"> {
	return Object.create(node, {
		[operatorSymbol]: {
			value: "+",
		},
		[usagesSymbol]: {
			value: 0,
			writable: true,
		},
		matches: {
			value(this: KleeneMatchable<"+">, nodeName: string) {
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

export function zeroOrOne<const T extends Matchable>(node: T): T & KleeneMatchable<"?"> {
	return Object.create(node, {
		[operatorSymbol]: {
			value: "?",
		},
		[usagesSymbol]: {
			value: 0,
			writable: true,
		},
		matches: {
			value(this: KleeneMatchable<"?">, nodeName: string) {
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

function assertPropBelongsToNode<T extends Matchable>(prop: unknown, node: T): prop is keyof T {
	return typeof node[prop as keyof T] !== "undefined";
}

export function or<const T extends Matchable[]>(...nodes: T): T[number] & KleeneMatchable<"|"> {
	let matchedNode: Matchable | undefined;

	function matches(nodeName: string): boolean {
		matchedNode = nodes.find((node) => node.matches(nodeName));
		return Boolean(matchedNode);
	}

	return new Proxy(
		{
			[operatorSymbol]: "|",
			[usagesSymbol]: 0,
		} as KleeneMatchable<"|">,
		{
			get(target, prop) {
				if (assertPropBelongsToNode(prop, target)) {
					return target[prop];
				}

				if (prop === "matches") {
					return matches;
				}

				if (!matchedNode) {
					throw new Error(`Cannot access to a property when no element has been matched yet`);
				}

				if (!assertPropBelongsToNode(prop, matchedNode)) {
					throw new Error("Klenee OR operator: property not found in matched element.");
				}

				return matchedNode[prop];
			},
		},
	);
}

export function ordered<const T extends Matchable[]>(
	...nodes: T
): T[number] & KleeneMatchable<"&"> {
	let matchedNode: Matchable | undefined;

	function matches(nodeName: string): boolean {
		matchedNode = nodes.find((node) => node.matches(nodeName));
		return Boolean(matchedNode);
	}

	return new Proxy(
		{
			[operatorSymbol]: "&",
			[usagesSymbol]: 0,
		} as KleeneMatchable<"&">,
		{
			get(target, prop) {
				if (assertPropBelongsToNode(prop, target)) {
					return target[prop];
				}

				if (prop === "matches") {
					return matches;
				}

				if (!matchedNode) {
					throw new Error(`Cannot access to a property when no element has been matched yet`);
				}

				if (!assertPropBelongsToNode(prop, matchedNode)) {
					throw new Error("Klenee Ordered operator: property not found in matched element.");
				}

				return matchedNode[prop];
			},
		},
	);
}
