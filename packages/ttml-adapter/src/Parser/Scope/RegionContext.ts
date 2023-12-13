import { Region } from "@sub37/server";
import { NodeWithRelationship } from "../Tags/NodeTree";
import type { Token } from "../Token";
import { createRegionParser } from "../parseRegion";
import type { Context, Scope } from "./Scope";

const regionContextSymbol = Symbol("region");

type RegionParser = ReturnType<typeof createRegionParser>;

interface RegionContextState {
	region: Token;
	children: NodeWithRelationship<Token>[];
}

interface RegionContext extends Context<RegionContext> {
	regions: Region[];
}

export function createRegionContext(contextState: RegionContextState[]): RegionContext {
	const regionParser: RegionParser = createRegionParser();

	return {
		parent: undefined,
		identifier: regionContextSymbol,
		get regions(): Region[] {
			const parentRegions: Region[] = this.parent?.regions ?? [];

			if (!regionParser.size) {
				for (let i = 0; i < contextState.length; i++) {
					regionParser.process(contextState[i].region, contextState[i].children);
				}
			}

			return [...Object.values(regionParser.getAll()), ...parentRegions];
		},
	};
}

export function readScopeRegionContext(scope: Scope): RegionContext | undefined {
	let context: Context | undefined;

	if (!(context = scope.getContextByIdentifier(regionContextSymbol))) {
		return undefined;
	}

	return context as RegionContext;
}
