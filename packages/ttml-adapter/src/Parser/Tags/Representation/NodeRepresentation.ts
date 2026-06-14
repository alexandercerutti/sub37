import { DerivationState } from "../../namespaces/tts/structure/operators.js";
import type {
	Derivable,
	DerivationResult,
	DerivedValue,
} from "../../namespaces/tts/structure/operators.js";

export interface NodeDerivedValue {
	nodeName: string;
	attributes: Set<string>;
	matchesAttribute(attr: string): boolean;
}

export type NodeRepresentation<ElementName extends string> = Derivable<
	ElementName,
	DerivedValue<"element", NodeDerivedValue>
> & {
	readonly nodeName: ElementName;
};

export function createNode<const T extends string>(
	nodeName: T,
	attributes: Set<string> = new Set<string>(),
	childrenFactory?: () => Derivable,
): NodeRepresentation<T> {
	return {
		nodeName,
		get type(): T {
			return nodeName as T;
		},
		derive(token: string): DerivationResult<DerivedValue<"element", NodeDerivedValue>> {
			if (nodeName !== token) {
				return {
					state: DerivationState.REJECTED,
					rejectionDetails: `Expected <${nodeName}>, got <${token}>`,
				};
			}

			const children = childrenFactory?.();

			if (!children) {
				return {
					state: DerivationState.DONE,
					values: [
						{
							type: "element",
							value: {
								nodeName,
								attributes,
								matchesAttribute(attr: string) {
									return matchesAttribute(attributes, attr);
								},
							},
						},
					],
				};
			}

			return {
				state: DerivationState.DERIVED,
				nextNode: children,
				values: [
					{
						type: "element",
						value: {
							nodeName,
							attributes,
							matchesAttribute(attr: string) {
								return matchesAttribute(attributes, attr);
							},
						},
					},
				],
			};
		},
	};
}

function matchesAttribute(attributes: Set<string>, attribute: string): boolean {
	for (const attr of attributes) {
		if (attr.endsWith("*") && attribute.startsWith(attr.slice(0, -1))) {
			return true;
		}

		if (attr === attribute) {
			return true;
		}
	}

	return false;
}
