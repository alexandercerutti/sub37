import { Region } from "@sub37/server";
import { NodeWithRelationship } from "../Tags/NodeTree";
import type { Token } from "../Token";
import { createRegionParser } from "../parseRegion.js";
import type { TTMLRegion } from "../parseRegion.js";
import type { Context, ContextFactory, Scope } from "./Scope";

const regionContextSymbol = Symbol("region");
const regionParserGetterSymbol = Symbol("region.parser");

type RegionParser = ReturnType<typeof createRegionParser>;

export interface RegionContainerContextState {
	attributes: Record<string, string>;
	children: NodeWithRelationship<Token>[];
}

interface RegionContainerContext extends Context<RegionContainerContext> {
	regions: Region[];
	getRegionById(id: string | undefined): TTMLRegion | undefined;
	getStylesByRegionId(id: string | undefined): Record<string, string>;
	[regionParserGetterSymbol]: RegionParser;
}

declare module "./Scope" {
	interface ContextDictionary {
		[regionContextSymbol]: RegionContainerContext;
	}
}

export function createRegionContainerContext(
	contextState: RegionContainerContextState[],
): ContextFactory<RegionContainerContext> {
	return function (scope: Scope) {
		if (!contextState.length) {
			return null;
		}

		const regionParser: RegionParser = createRegionParser();

		return {
			parent: undefined,
			identifier: regionContextSymbol,
			mergeWith(context: RegionContainerContext) {
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
			getRegionById(id: string | undefined): TTMLRegion | undefined {
				if (!id?.length) {
					return undefined;
				}

				const regions = this.regions as TTMLRegion[];
				return regions.filter((region) => region.id === id)[0];
			},
			getStylesByRegionId(id: string | undefined): Record<string, string> {
				/**
				 * Note: if no processing happened before by invoking `.regions`,
				 * this will return empty. Might want to force processing
				 * when invoking this, but I want to be sure.
				 */
				const region = regionParser.get(id);
				return region.styles;
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
	};
}

export function readScopeRegionContext(scope: Scope): RegionContainerContext | undefined {
	return scope.getContextByIdentifier(regionContextSymbol);
}
