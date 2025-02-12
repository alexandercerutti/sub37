export type DestinationFactory = () => NodeRepresentation<string>[];

export interface NodeRepresentation<T extends string> {
	nodeName: T;
	destinationFactory: DestinationFactory;
	matches(nodeName: string): boolean;
}

export function createNode<const T extends string>(
	nodeName: T,
	destinationFactory: DestinationFactory = () => [],
): NodeRepresentation<T> {
	return {
		nodeName: nodeName,
		destinationFactory,
		matches(nodeNameMatch: string): boolean {
			return this.nodeName === nodeNameMatch;
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
