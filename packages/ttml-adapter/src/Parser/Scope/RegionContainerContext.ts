import { Region } from "@sub37/server";
import { NodeWithRelationship } from "../Tags/NodeTree";
import type { Token } from "../Token";
import { isUniquelyAnnotatedNode } from "../Token";
import type { Context, ContextFactory, Scope } from "./Scope";
import { onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import { createStyleParser, isStyleAttribute } from "../parseStyle";
import { TTMLStyle } from "./StyleContainerContext";
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
		const styleParser = createStyleParser(scope);

		function stylesRetriever(): TTMLStyle[] {
			return [styleParser.get("inline"), styleParser.get("nested")].filter(Boolean) as TTMLStyle[];
		}

		return {
			parent: undefined,
			identifier: regionContextSymbol,
			get args() {
				return contextState;
			},
			[onAttachedSymbol](): void {
				for (const { attributes, children } of contextState) {
					if (!isUniquelyAnnotatedNode(attributes)) {
						continue;
					}

					const regionTimingAttributes =
						(hasTimingAttributes(attributes) && {
							begin: attributes["begin"],
							dur: attributes["dur"],
							end: attributes["end"],
							timeContainer: attributes["timeContainer"],
						}) ||
						undefined;

					const region = new TTMLRegion(
						attributes["xml:id"] || "inline",
						regionTimingAttributes,
						stylesRetriever,
					);

					regionsIDREFSStorage.set(region.id, region);

					if (Object.keys(attributes).some(isStyleAttribute)) {
						styleParser.process(
							Object.create(attributes, {
								/**
								 * If attributes contains an xml:id, it is the region id.
								 * However, we want to define the id for the styles.
								 *
								 * The attributes will be filtered once the style will be
								 * processed when attributes getter in styleParser is accessed.
								 */
								"xml:id": {
									value: "inline",
									enumerable: true,
								},
							}),
						);
					}

					if (children.length) {
						styleParser.process(
							Object.create(extractNestedStylesChildren(children), {
								"xml:id": {
									value: "nested",
									enumerable: true,
								},
							}),
						);
					}
				}
			},
			[onMergeSymbol](incomingContext: RegionContainerContext): void {
				const { args } = incomingContext;

				for (const { attributes, children } of args) {
					if (!isUniquelyAnnotatedNode(attributes)) {
						continue;
					}

					const regionTimingAttributes =
						(hasTimingAttributes(attributes) && {
							begin: attributes["begin"],
							dur: attributes["dur"],
							end: attributes["end"],
							timeContainer: attributes["timeContainer"],
						}) ||
						undefined;

					const region = new TTMLRegion(
						attributes["xml:id"] || "inline",
						regionTimingAttributes,
						stylesRetriever,
					);

					regionsIDREFSStorage.set(region.id, region);

					if (Object.keys(attributes).some(isStyleAttribute)) {
						styleParser.process(
							Object.create(attributes, {
								/**
								 * If attributes contains an xml:id, it is the region id.
								 * However, we want to define the id for the styles.
								 *
								 * The attributes will be filtered once the style will be
								 * processed when attributes getter in styleParser is accessed.
								 */
								"xml:id": {
									value: "inline",
									enumerable: true,
								},
							}),
						);
					}

					if (children.length) {
						styleParser.process(
							Object.create(extractNestedStylesChildren(children), {
								"xml:id": {
									value: "nested",
									enumerable: true,
								},
							}),
						);
					}
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

function extractNestedStylesChildren(
	regionChildren: NodeWithRelationship<Token>[],
): Record<string, string> {
	const nestedStyles: Record<string, string> = {};

	for (const styleToken of regionChildren) {
		if (styleToken.content.content !== "style") {
			continue;
		}

		const { "xml:id": id, ...attributes } = styleToken.content.attributes;

		Object.assign(nestedStyles, attributes);
	}

	return nestedStyles;
}

export class TTMLRegion implements Region {
	public id: string;
	public timingAttributes?: TimeContextData;
	public lines: number = 2;

	public stylesRetriever: () => TTMLStyle[];

	public constructor(
		id: string,
		timingAttributes: TimeContextData | undefined,
		stylesRetriever: TTMLRegion["stylesRetriever"],
	) {
		this.id = id;
		this.timingAttributes = timingAttributes;
		this.stylesRetriever = stylesRetriever;
	}

	public getOrigin(): [x: number, y: number] {
		return [0, 0];
	}

	public get width(): number {
		return 100;
	}

	public get styles(): TTMLStyle[] {
		return this.stylesRetriever() || [];
	}
}
