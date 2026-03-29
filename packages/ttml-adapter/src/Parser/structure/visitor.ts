import type { Matchable } from "./kleene.js";

export interface Visitor<T extends Matchable> {
	match(nodeName: string): T | null;
}

export function createVisitor<T extends Matchable>(node: T): Visitor<T> {
	const destinations = node.destinationFactory() ?? [];

	return {
		match(nodeName: string): T | null {
			let currentIndex = 0;

			while (currentIndex < destinations.length) {
				const dest = destinations[currentIndex] as T;

				if (!dest.matches(nodeName)) {
					currentIndex++;
					continue;
				}

				return dest;
			}

			return null;
		},
	};
}
