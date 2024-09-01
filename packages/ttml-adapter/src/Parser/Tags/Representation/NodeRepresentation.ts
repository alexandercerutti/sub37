export interface NodeRepresentation<T extends string> {
	nodeName: T;
	destinationFactory(): NodeRepresentation<string>[];
	matches(nodeName: string): boolean;
}

export function createNode<const T extends string>(
	nodeName: T,
	destinationFactory: NodeRepresentation<string>["destinationFactory"] = () => [],
): NodeRepresentation<T> {
	return {
		nodeName: nodeName,
		destinationFactory: destinationFactory,
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
