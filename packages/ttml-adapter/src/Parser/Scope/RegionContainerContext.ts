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
	getRegionsById(id: string | undefined): TTMLRegion[];
	[regionParserGetterSymbol]: RegionParser;
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
			getRegionsById(id: string | undefined): TTMLRegion[] {
				if (!id?.length) {
					return [];
				}

				const regions = this.regions as TTMLRegion[];
				return regions.filter((region) => region.id === id);
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
	let context: Context | undefined;

	if (!(context = scope.getContextByIdentifier(regionContextSymbol))) {
		return undefined;
	}

	return context as RegionContainerContext;
}

/**
 * 8.1.4 div
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#content-vocabulary-div
 *
 * 8.1.5 p
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#content-vocabulary-p
 *
 * These element are defined to have up to one
 * inline region element inside of them (Kleene operators)
 *
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#conventions
 *
 * @see https://w3c.github.io/ttml2/#semantics-inline-regions
 *
 * @param parentId parent's xml:id
 * @param childrenTokens parent's children
 * @returns {[RegionContainerContextState]} A tuple to be given to the region context
 */

export function findInlineRegionInChildren(
	parentId: string,
	childrenTokens: NodeWithRelationship<Token>[],
): [RegionContainerContextState] | undefined {
	for (let i = 0; i < childrenTokens.length; i++) {
		const { content: token, children } = childrenTokens[i];

		if (token.content !== "region") {
			continue;
		}

		/**
		 * if the `[attributes]` information item property of R does not include
		 * an `xml:id` attribute, then add an implied `xml:id` attribute with a
		 * generated value _ID_ that is unique within the scope of the TTML
		 * document instance;
		 *
		 * otherwise, let _ID_ be the value of the `xml:id` attribute of R;
		 */

		const regionId = token.attributes["xml:id"] || parentId;

		return [
			{
				attributes: Object.create(token.attributes, {
					"xml:id": {
						value: regionId,
					},
				}),
				children,
			},
		];
	}

	return undefined;
}
