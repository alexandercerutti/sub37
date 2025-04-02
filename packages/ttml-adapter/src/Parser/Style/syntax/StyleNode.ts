import type { DestinationFactory, Matchable } from "../../structure/kleene.js";

export type MatchableStyleNode<T extends string, SN extends string = string> = Matchable<{
	nodeName: T;
	semanticName: SN;
	validate(attribute: string): Array<string> | string | undefined;
	matches(nodeName: string): Array<string> | string | undefined;
}>;

export type StyleValidator = (attribute: string) => Array<string> | string | undefined;

export function createStyleNode<const T extends string, const SN extends string>(
	nodeName: T,
	semanticName: SN,
	destinationFactory: DestinationFactory<MatchableStyleNode<string, string>> = () => [],
	validator?: StyleValidator,
): MatchableStyleNode<T, SN> {
	let lastValidationAttribute: Array<string> | string | undefined = undefined;

	return {
		nodeName,
		semanticName,
		matches(nodeValue: string) {
			if (typeof validator === "undefined") {
				return nodeValue === nodeName ? nodeName : undefined;
			}

			const validationResult = validator?.(nodeValue);

			if (!validationResult) {
				return undefined;
			}

			lastValidationAttribute = validationResult;
			return lastValidationAttribute;
		},
		destinationFactory,
		validate(attribute: string) {
			if (typeof validator === "undefined") {
				return attribute;
			}

			if (lastValidationAttribute) {
				return lastValidationAttribute;
			}

			const validationResults = validator(attribute);

			if (!validationResults) {
				return undefined;
			}

			return validationResults;
		},
	};
}
