import { Region } from "@sub37/server";
import { NodeWithRelationship } from "../Tags/NodeTree";
import type { Token } from "../Token";
import { createRegionParser } from "../parseRegion";
import type { Context, Scope } from "./Scope";

const regionContextSymbol = Symbol("region");
const regionParserGetterSymbol = Symbol("region.parser");

type RegionParser = ReturnType<typeof createRegionParser>;

export interface RegionContextState {
	attributes: Record<string, string>;
	children: NodeWithRelationship<Token>[];
}

interface RegionContext extends Context<RegionContext> {
	regions: Region[];
	[regionParserGetterSymbol]: RegionParser;
}

export function createRegionContext(contextState: RegionContextState[]): RegionContext | null {
	if (!contextState.length) {
		return null;
	}

	const regionParser: RegionParser = createRegionParser();

	return {
		parent: undefined,
		identifier: regionContextSymbol,
		mergeWith(context: RegionContext) {
			// Processing the actual regions first
			if (!regionParser.size) {
				for (let i = 0; i < contextState.length; i++) {
					regionParser.process(contextState[i].attributes, contextState[i].children);
				}
			}

			const contextRegions = context[regionParserGetterSymbol].getAll();

			for (const [id, data] of Object.entries(contextRegions)) {
				regionParser.push([id, data]);
			}
		},
		get [regionParserGetterSymbol]() {
			return regionParser;
		},
		get regions(): Region[] {
			const parentRegions: Region[] = this.parent?.regions ?? [];

			if (!regionParser.size) {
				for (let i = 0; i < contextState.length; i++) {
					regionParser.process(contextState[i].attributes, contextState[i].children);
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
