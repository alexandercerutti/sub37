import type { NodeRepresentation } from "./NodeRepresentation";

interface HistoryListNode {
	node: NodeRepresentation<string> | null;
	destinations: NodeRepresentation<string>[];
	lastDestinationIndex: number;
	prev: HistoryListNode;
}

interface Visitor {
	match(nodeName: string): NodeRepresentation<string> | null;
	navigate?(node: NodeRepresentation<string>): void;
	back(): void;
}

export function createVisitor(node: NodeRepresentation<string>): Visitor {
	let historyList: HistoryListNode = {
		node,
		destinations: node.destinationFactory?.() ?? [],
		lastDestinationIndex: 0,
		prev: null,
	};

	return {
		match(nodeName: string): NodeRepresentation<string> | null {
			const { destinations, lastDestinationIndex } = historyList;

			/**
			 * Once a node doesn't match, we go on to preserve order
			 */

			let nextDestinationIndex = lastDestinationIndex;

			while (nextDestinationIndex < destinations.length) {
				const dest = destinations[nextDestinationIndex];

				if (dest.matches(nodeName)) {
					/**
					 * Committing the last index. So we mark we found a match
					 * and we can start back again from here later.
					 */
					historyList.lastDestinationIndex = nextDestinationIndex;
					return dest;
				}

				nextDestinationIndex++;
			}

			return null;
		},
		navigate(node: NodeRepresentation<string>): void {
			historyList = {
				node,
				destinations: node.destinationFactory?.() ?? [],
				prev: historyList,
				lastDestinationIndex: 0,
			};
		},
		back(): void {
			if (!historyList.prev) {
				historyList = {
					node: null,
					destinations: node.destinationFactory?.() ?? [],
					lastDestinationIndex: 0,
					prev: null,
				};

				return;
			}

			historyList = historyList.prev;
		},
	};
}
