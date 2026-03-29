import { Region } from "@sub37/server";
import { NodeWithRelationship } from "../Tags/NodeTree";
import type { Token, UniquelyAnnotatedNode } from "../Token";
import { isUniquelyAnnotatedNode } from "../Token";
import type { Context, ContextFactory, Scope } from "./Scope";
import { createScope, onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import { isStyleAttribute } from "../parseStyle";
import {
	createStyleContainerContext,
	readScopeStyleContainerContext,
	TTMLStyle,
} from "./StyleContainerContext";
import type { TimeContextData } from "./TimeContext";

const regionContextSymbol = Symbol("region");

export interface RegionContainerContextState {
	attributes: Record<string, string>;
	children: NodeWithRelationship<Token>[];
}

interface RegionContainerContext extends Context<
	RegionContainerContext,
	RegionContainerContextState[]
> {
	regions: Region[];
	getRegionById(id: string | undefined): TTMLRegion | undefined;
	getStylesByRegionId(id: string | undefined): TTMLStyle[];
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

		const regionsIDREFSStorage = new Map<string, TTMLRegion>();

		return {
			parent: undefined,
			identifier: regionContextSymbol,
			get args() {
				return contextState;
			},
			[onAttachedSymbol](): void {
				for (const region of contextState) {
					if (!isUniquelyAnnotatedNode(region.attributes)) {
						continue;
					}

					const ttmlRegion = createTTMLRegion(region);

					regionsIDREFSStorage.set(ttmlRegion.id, ttmlRegion);
				}
			},
			[onMergeSymbol](incomingContext: RegionContainerContext): void {
				const { args } = incomingContext;

				for (const incomingRegion of args) {
					if (!isUniquelyAnnotatedNode(incomingRegion.attributes)) {
						continue;
					}

					const incomingTTMLRegion = createTTMLRegion(incomingRegion);

					regionsIDREFSStorage.set(incomingTTMLRegion.id, incomingTTMLRegion);
				}
			},
			getRegionById(id: string | undefined): TTMLRegion | undefined {
				if (!id?.length) {
					return undefined;
				}

				return regionsIDREFSStorage.get(id) ?? this.parent?.getRegionById(id);
			},
			getStylesByRegionId(id: string): TTMLStyle[] {
				if (!id?.length) {
					throw new Error("Cannot retrieve styles for a region with an unknown name.");
				}

				return regionsIDREFSStorage.get(id)?.styles || [];
			},
			get regions(): Region[] {
				const parentRegions: Region[] = this.parent?.regions ?? [];

				return parentRegions.concat(Array.from(regionsIDREFSStorage.values()));
			},
		};
	};
}

export function readScopeRegionContext(scope: Scope): RegionContainerContext | undefined {
	return scope.getContextByIdentifier(regionContextSymbol);
}

/**
 * Checks if the element is suitable for
 * containing time attributes and if it
 * actually have them
 *
 * @param token
 * @returns
 */
function hasTimingAttributes(attributes: Record<string, string>): boolean {
	return (
		"begin" in attributes ||
		"end" in attributes ||
		"dur" in attributes ||
		"timeContainer" in attributes
	);
}

function extractInlineStyles(
	regionAttributes: Record<string, string>,
): Record<string, string> & UniquelyAnnotatedNode {
	const inlineStyles: Record<string, string> = {};

	for (const [ttsKey, ttsValue] of Object.entries(regionAttributes)) {
		if (!isStyleAttribute(ttsKey)) {
			continue;
		}

		inlineStyles[ttsKey] = ttsValue;
	}

	return Object.create(inlineStyles, {
		"xml:id": {
			value: "inline",
			enumerable: true,
		},
	});
}

function extractNestedStylesChildren(
	regionChildren: NodeWithRelationship<Token>[],
): Record<string, string> & UniquelyAnnotatedNode {
	const nestedStyles: Record<string, string> = {};

	for (const styleToken of regionChildren) {
		if (styleToken.content.content !== "style") {
			continue;
		}

		const { "xml:id": id, ...attributes } = styleToken.content.attributes;

		Object.assign(nestedStyles, attributes);
	}

	return Object.create(nestedStyles, {
		"xml:id": {
			value: "nested",
			enumerable: true,
		},
	});
}

function createTTMLRegion(regionContextState: RegionContainerContextState): TTMLRegion {
	const { attributes, children } = regionContextState;

	const regionTimingAttributes =
		(hasTimingAttributes(attributes) && {
			begin: attributes["begin"],
			dur: attributes["dur"],
			end: attributes["end"],
			timeContainer: attributes["timeContainer"],
		}) ||
		undefined;

	const subscope = createScope(
		undefined,
		createStyleContainerContext([
			extractInlineStyles(attributes),
			extractNestedStylesChildren(children),
		]),
	);

	return new TTMLRegion(attributes["xml:id"] || "inline", regionTimingAttributes, subscope);
}

export class TTMLRegion implements Region {
	public id: string;
	public timingAttributes?: TimeContextData;
	public lines: number = 2;
	public scope: Scope;

	public constructor(id: string, timingAttributes: TimeContextData | undefined, scope: Scope) {
		this.id = id;
		this.timingAttributes = timingAttributes;
		this.scope = scope;
	}

	public getOrigin(): [x: number, y: number] {
		return [0, 0];
	}

	public get width(): number {
		return 100;
	}

	public get styles(): TTMLStyle[] {
		const styleContext = readScopeStyleContainerContext(this.scope);

		if (!styleContext) {
			return [];
		}

		return [styleContext.getStyleByIDRef("inline"), styleContext.getStyleByIDRef("nested")].filter(
			Boolean,
		) as TTMLStyle[];
	}
}
