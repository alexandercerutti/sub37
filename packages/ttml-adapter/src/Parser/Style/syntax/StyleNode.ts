import type { DestinationFactory, Matchable } from "../../structure/kleene.js";

export type MatchableStyleNode<T extends string, SN extends string = string> = Matchable<{
	nodeName: T;
	semanticName: SN;
	matches(nodeName: string): Array<string> | string | undefined;
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
