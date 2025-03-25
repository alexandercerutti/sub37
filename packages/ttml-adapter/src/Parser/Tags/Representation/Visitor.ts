import type { Matchable } from "./kleene";

interface HistoryListNode<T extends Matchable> {
	node: T | null;
	destinations: T[];
	lastDestinationIndex: number;
	prev: HistoryListNode<T>;
}

interface Visitor<T extends Matchable> {
	match(nodeName: string): T | null;
	navigate?(node: T): void;
	back(): void;
}

export function createVisitor<T extends Matchable>(node: T): Visitor<T> {
	let historyList: HistoryListNode<T> = {
		node,
		destinations: (node.destinationFactory?.() ?? []) as T[],
		lastDestinationIndex: 0,
		prev: null,
	};

	return {
		match(nodeName: string): T | null {
			const { destinations, lastDestinationIndex } = historyList;

			/**
			 * Once a node doesn't match, we go on to preserve order
			 */

			let nextDestinationIndex = lastDestinationIndex;

			while (nextDestinationIndex < destinations.length) {
				const dest = destinations[nextDestinationIndex];

				if (!dest.matches(nodeName)) {
					nextDestinationIndex++;
					continue;
				}

				/**
				 * Committing the last index. So we mark we found a match
				 * and we can start back again from here later.
				 */
				historyList.lastDestinationIndex = nextDestinationIndex;
				return dest;
			}

			return null;
		},
		navigate(node: T): void {
			historyList = {
				node,
				destinations: (node.destinationFactory?.() ?? []) as T[],
				prev: historyList,
				lastDestinationIndex: 0,
			};
		},
		back(): void {
			if (!historyList.prev) {
				historyList = {
					node: null,
					destinations: (node.destinationFactory?.() ?? []) as T[],
					lastDestinationIndex: 0,
					prev: null,
				};

				return;
			}

			historyList = historyList.prev;
		},
	};
}
