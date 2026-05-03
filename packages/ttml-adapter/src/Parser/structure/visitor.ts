import type { Matchable } from "./kleene.js";

export interface Visitor<T extends Matchable> {
	match(nodeName: string): T | null;
}

export function createVisitor<T extends Matchable>(node: T): Visitor<T> {
	const destinations = node.destinationFactory() ?? [];

	let currentIndex = 0;

	return {
		match(nodeName: string): T | null {
			let currentElementIndex = currentIndex;

			while (currentElementIndex < destinations.length) {
				const dest = destinations[currentElementIndex] as T;

				if (!dest.matches(nodeName)) {
					currentElementIndex++;
					continue;
				}

				currentIndex = currentElementIndex;
				return dest;
			}

			return null;
		},
	};
}
