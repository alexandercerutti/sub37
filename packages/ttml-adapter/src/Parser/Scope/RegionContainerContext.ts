import { Region } from "@sub37/server";
import { NodeWithRelationship } from "../Tags/NodeTree";
import type { Token } from "../Token";
import { createRegionParser } from "../parseRegion.js";
import type { TTMLRegion } from "../parseRegion.js";
import type { Context, ContextFactory, Scope } from "./Scope";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import type { TTMLStyle } from "../parseStyle";

const regionContextSymbol = Symbol("region");
const regionParserGetterSymbol = Symbol("region.parser");

type RegionParser = ReturnType<typeof createRegionParser>;

export interface RegionContainerContextState {
	attributes: Record<string, string>;
	children: NodeWithRelationship<Token>[];
}

interface RegionContainerContext
	extends Context<RegionContainerContext, RegionContainerContextState[]> {
	regions: Region[];
	getRegionById(id: string | undefined): TTMLRegion | undefined;
	getStylesByRegionId(id: string | undefined): TTMLStyle[];
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

		const regionParser: RegionParser = createRegionParser(scope);

		return {
			parent: undefined,
			identifier: regionContextSymbol,
			get args() {
				return contextState;
			},
			[onAttachedSymbol](): void {
				for (const { attributes, children } of contextState) {
					regionParser.process(attributes, children);
				}
			},
			[onMergeSymbol](context: RegionContainerContext) {
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
				return regions.find((region) => region.id === id);
			},
			getStylesByRegionId(id: string): TTMLStyle[] {
				if (!id?.length) {
					throw new Error("Cannot retrieve styles for a region with an unknown name.");
				}

				/** Pre-heating regions processing - if regions are not processed, we might get screwed */
				if (!this.regions.some((r) => r.id === id)) {
					return [];
				}

				return regionParser.get(id).styles;
			},
			get regions(): Region[] {
				const parentRegions: Region[] = this.parent?.regions ?? [];

				return parentRegions.concat(Object.values(regionParser.getAll()));
			},
		};
	};
}

export function readScopeRegionContext(scope: Scope): RegionContainerContext | undefined {
	return scope.getContextByIdentifier(regionContextSymbol);
}
