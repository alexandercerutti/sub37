import type { Region } from "@sub37/server";
import { Entities } from "@sub37/server";
import { NodeWithRelationship } from "../Tags/NodeTree";
import type { Token } from "../Token";
import { isUniquelyAnnotatedNode } from "../Token";
import type { Context, ContextFactory, Scope } from "./Scope";
import { createScope, isolateContext, onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import { isStyleAttribute } from "../parseStyle";
import {
	createStyleContainerContext,
	readScopeStyleContainerContext,
} from "./StyleContainerContext";
import type { StyleContainerContextState, TTMLStyle } from "./StyleContainerContext";
import type { TimeContextData } from "./TimeContext";
import {
	Animation,
	AnimationContainerContextState,
	createAnimationContainerContext,
	readScopeAnimationContext,
} from "./AnimationContainerContext";

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
	getRegionById(idref: string | undefined): TTMLRegion | undefined;
	getStylesByRegionId(idref: string | undefined): TTMLStyle[];
	getAnimationsByRegionId(idref: string | undefined): Animation[];
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

					const ttmlRegion = createTTMLRegion(region, scope);

					regionsIDREFSStorage.set(ttmlRegion.id, ttmlRegion);
				}
			},
			[onMergeSymbol](incomingContext: RegionContainerContext): void {
				const { args } = incomingContext;

				for (const incomingRegion of args) {
					if (!isUniquelyAnnotatedNode(incomingRegion.attributes)) {
						continue;
					}

					const incomingTTMLRegion = createTTMLRegion(incomingRegion, scope);

					regionsIDREFSStorage.set(incomingTTMLRegion.id, incomingTTMLRegion);
				}
			},
			getRegionById(idref: string | undefined): TTMLRegion | undefined {
				if (!idref?.length) {
					return undefined;
				}

				return regionsIDREFSStorage.get(idref) ?? this.parent?.getRegionById(idref);
			},
			getStylesByRegionId(idref: string): TTMLStyle[] {
				if (!idref?.length) {
					throw new Error("Cannot retrieve styles for a region with an unknown name.");
				}

				return regionsIDREFSStorage.get(idref)?.styles || [];
			},
			getAnimationsByRegionId(idref: string): Animation[] {
				return regionsIDREFSStorage.get(idref)?.animations || [];
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

// ************************* //
// *** TIMING EXTRACTION *** //
// ************************* //
// region timing extraction

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

// ************************* //
// *** STYLES EXTRACTION *** //
// ************************* //
// region styles

function extractInlineStyles(regionAttributes: Record<string, string>): StyleContainerContextState {
	const inlineStyles: Record<string, string> = {};

	for (const [ttsKey, ttsValue] of Object.entries(regionAttributes)) {
		if (!isStyleAttribute(ttsKey)) {
			continue;
		}

		inlineStyles[ttsKey] = ttsValue;
	}

	return Object.create(inlineStyles, {
		"xml:id": {
			value:
				inlineStyles["xml:id"] || `region-inline:${Math.floor(Math.random() * (500 - 100) + 100)}`,
		},
		kind: {
			value: "inline",
			enumerable: true,
		},
	});
}

function extractNestedStylesChildren(
	regionChildren: NodeWithRelationship<Token>[],
): StyleContainerContextState {
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
			value: `region-nested:${Math.floor(Math.random() * (500 - 100) + 100)}`,
		},
		kind: {
			value: "nested",
			enumerable: true,
		},
	});
}

// ***************************** //
// *** ANIMATIONS EXTRACTION *** //
// ***************************** //
// region nested animations

function extractNestedAnimationsChildren(
	regionChildren: NodeWithRelationship<Token>[],
): AnimationContainerContextState[] {
	if (!regionChildren.length) {
		return [];
	}

	const animations: AnimationContainerContextState[] = [];

	for (const { content: tokenContent } of regionChildren) {
		if (tokenContent.content !== "animate" && tokenContent.content !== "set") {
			continue;
		}

		const animationId =
			tokenContent.attributes["xml:id"] ||
			`region-animation:${Math.floor(Math.random() * (500 - 100) + 100)}`;

		animations.push({
			attributes: Object.create(tokenContent.attributes, {
				"xml:id": {
					value: animationId,
				},
			}),
			calcMode: tokenContent.content === "set" ? "discrete" : tokenContent.attributes["calcMode"],
		});
	}

	return animations;
}

// **************************** //
// *** TTML REGION CREATION *** //
// **************************** //
// region TTML Region

function createTTMLRegion(
	regionContextState: RegionContainerContextState,
	sourceScope: Scope,
): TTMLRegion {
	const { attributes, children } = regionContextState;

	const regionTimingAttributes =
		(hasTimingAttributes(attributes) && {
			begin: attributes["begin"],
			dur: attributes["dur"],
			end: attributes["end"],
			timeContainer: attributes["timeContainer"],
		}) ||
		undefined;

	/**
	 * Contexts will become isolated
	 */
	const subscope = createScope(
		sourceScope,
		createStyleContainerContext([
			extractInlineStyles(attributes),
			extractNestedStylesChildren(children),
		]),
		createAnimationContainerContext(
			//
			extractNestedAnimationsChildren(children),
		),
	);

	return new TTMLRegion(attributes["xml:id"] || "inline", regionTimingAttributes, subscope);
}

const REGION_GEOMETRY_ATTRIBUTES = new Set(["tts:origin", "tts:extent", "tts:position"]);

export class TTMLRegion implements Region {
	public id: string;
	public timingAttributes?: TimeContextData;
	public lines: number = 2;
	public scope: Scope;

	private geometryStylesCache: Record<string, string> | undefined = undefined;
	private visualStylesCache: Record<string, string> | undefined = undefined;

	public get entities(): Entities.AllEntities[] {
		const styles = this.computeVisualStyles();
		return Object.keys(styles).length ? [Entities.createLocalStyleEntity(styles)] : [];
	}

	public constructor(id: string, timingAttributes: TimeContextData | undefined, scope: Scope) {
		this.id = id;
		this.timingAttributes = timingAttributes;
		this.scope = scope;
	}

	public getOrigin(
		_viewportWidth?: number,
		_viewportHeight?: number,
	): [x: number | string, y: number | string] {
		const styles = this.computeGeometryStyles();

		return [styles["x"] ?? 0, styles["y"] ?? 0];
	}

	public get width(): string {
		return this.computeGeometryStyles()["width"] ?? "100%";
	}

	public get height(): string | undefined {
		return this.computeGeometryStyles()["height"];
	}

	public get styles(): TTMLStyle[] {
		const styleContext = isolateContext(readScopeStyleContainerContext(this.scope));

		if (!styleContext) {
			return [];
		}

		return styleContext.styles;
	}

	public get animations(): Animation[] {
		const animationContext = isolateContext(readScopeAnimationContext(this.scope));

		if (!animationContext) {
			return [];
		}

		return animationContext.animations;
	}

	private computeGeometryStyles(): Record<string, string> {
		if (this.geometryStylesCache) {
			return this.geometryStylesCache;
		}

		const styleContext = isolateContext(readScopeStyleContainerContext(this.scope));

		if (!styleContext) {
			return {};
		}

		const { styles } = styleContext;

		this.geometryStylesCache = styles
			.filter((s) => s.kind === "nested")
			.concat(styles.filter((s) => s.kind === "inline"))
			.reduce<Record<string, string>>((acc, style) => {
				const filtered = Object.fromEntries(
					Object.entries(style.styleAttributes).filter(([attr]) =>
						REGION_GEOMETRY_ATTRIBUTES.has(attr),
					),
				);

				const filteredStyle = Object.create(style, {
					styleAttributes: { value: filtered, enumerable: true },
				});

				return Object.assign(acc, filteredStyle.apply("region"));
			}, {});

		return this.geometryStylesCache;
	}

	private computeVisualStyles(): Record<string, string> {
		if (this.visualStylesCache) {
			return this.visualStylesCache;
		}

		const styleContext = isolateContext(readScopeStyleContainerContext(this.scope));

		if (!styleContext) {
			return {};
		}

		const { styles } = styleContext;

		this.visualStylesCache = styles
			.filter((s) => s.kind === "nested")
			.concat(styles.filter((s) => s.kind === "inline"))
			.reduce<Record<string, string>>((acc, style) => {
				const visualStyleAttributes: Record<string, string> = {};

				for (const attr in style.styleAttributes) {
					if (!REGION_GEOMETRY_ATTRIBUTES.has(attr)) {
						visualStyleAttributes[attr] = style.styleAttributes[attr]!;
					}
				}

				const filteredStyle = Object.create(style, {
					styleAttributes: {
						value: visualStyleAttributes,
						enumerable: true,
					},
				});

				return Object.assign(acc, filteredStyle.apply("region"));
			}, {});

		return this.visualStylesCache;
	}
}
