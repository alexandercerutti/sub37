import { isDerived, isRejected } from "../namespaces/tts/structure/operators.js";
import type { Derivable, DerivedValue } from "../namespaces/tts/structure/operators.js";
import type { NodeDerivedValue } from "../Tags/Representation/NodeRepresentation.js";

export interface Visitor {
	matchesAttribute(attr: string): boolean;
	match(nodeName: string): Visitor | null;
}

export function createVisitor(grammar: Derivable | null | undefined): Visitor {
	return {
		matchesAttribute(): boolean {
			return false;
		},
		match(nodeName: string): Visitor | null {
			if (!grammar) {
				return null;
			}

			const result = grammar.derive(nodeName);

			if (isRejected(result)) {
				return null;
			}

			/**
			 * When optional items are skipped, undefined is return in the
			 * values array.
			 */
			const wrapped = result.values.find(
				(v): v is DerivedValue<"element", NodeDerivedValue> => v?.type === "element",
			);

			if (!wrapped) {
				return null;
			}

			const { value: elementValue } = wrapped;
			const childrenGrammar = isDerived(result) ? result.nextNode : null;

			return {
				matchesAttribute(attr: string): boolean {
					return elementValue.matchesAttribute(attr);
				},
				match(childName: string): Visitor | null {
					return createVisitor(childrenGrammar).match(childName);
				},
			};
		},
	};
}
