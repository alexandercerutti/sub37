import type { DestinationFactory, Matchable } from "./kleene";

export type NodeRepresentation<T extends string> = Matchable<{
	nodeName: T;
	matchesAttribute(attribute: string): boolean;
}>;

export function createNode<const T extends string>(
	nodeName: T,
	attributes: Set<string> = new Set<string>(),
	destinationFactory: DestinationFactory<NodeRepresentation<T>> = () => [],
): NodeRepresentation<T> {
	return {
		nodeName: nodeName,
		destinationFactory,
		matches(nodeNameMatch: string): boolean {
			return this.nodeName === nodeNameMatch;
		},
		matchesAttribute(attribute: string): boolean {
			for (const attr of attributes) {
				if (attr.endsWith("*") && attribute.startsWith(attr.slice(0, -1))) {
					return true;
				}

				if (attr === attribute) {
					return true;
				}
			}

			return false;
		},
	};
}

export function withSelfReference<const T extends string>(
	node: NodeRepresentation<T>,
): NodeRepresentation<T> {
	const selfReferencedNode = Object.create(node, {
		destinationFactory: {
			value: () => [selfReferencedNode, ...(node.destinationFactory?.() ?? [])],
		},
	});

	return selfReferencedNode;
}
