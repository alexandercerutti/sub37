import type { DestinationFactory, Matchable } from "../../Tags/Representation/kleene.js";

export type MatchableStyleNode<T extends string, SN extends string = string> = Matchable<{
	nodeName: T;
	semanticName: SN;
}>;

export function createStyleNode<const T extends string, const SN extends string>(
	nodeName: T,
	semanticName: SN,
	destinationFactory: DestinationFactory<MatchableStyleNode<string, string>> = () => [],
): MatchableStyleNode<T, SN> {
	return {
		nodeName,
		semanticName,
		matches() {
			return true;
		},
		destinationFactory,
	};
}
