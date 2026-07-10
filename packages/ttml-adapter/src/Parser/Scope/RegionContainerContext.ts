import * as Entities from "@sub37/adapter-utils/Entities";
import type { Region } from "@sub37/adapter-utils";
import { NodeWithRelationship } from "../Tags/NodeTree.js";
import type { Token } from "../Token.js";
import { isAnimateOrSetElement, nodeScopeSymbol } from "../../Adapter.js";
import type { NodeWithScope } from "../../Adapter.js";
import { isUniquelyAnnotatedNode, generateSyntheticId } from "../namespaces/xml/id.js";
import type { Context, ContextFactory, Scope } from "./Scope.js";
import { createScope, isolateContext, onAttachedSymbol, onMergeSymbol } from "./Scope.js";
import { isStyleAttribute } from "../parseStyle.js";
import {
	createStyleContainerContext,
	readScopeStyleContainerContext,
} from "./StyleContainerContext.js";
import type { StyleContainerContextState, TTMLStyle } from "./StyleContainerContext.js";
import type { TimeContextData } from "./TimeContext.js";
import { createTimeContext, readScopeTimeContext } from "./TimeContext.js";
import {
	AnimationContainerContextState,
	createAnimationContainerContext,
	readScopeAnimationContext,
} from "./AnimationContainerContext.js";
import {
	createTemporalActiveContext,
	readScopeTemporalActiveContext,
} from "./TemporalActiveContext.js";
import { readScopeErrorContext } from "./ErrorContext.js";

const regionContextSymbol = Symbol("region");

export interface RegionContainerContextState {
	attributes: Record<string, string>;
	children: NodeWithRelationship<Token & NodeWithScope>[];
}

interface RegionContainerContext extends Context<
	RegionContainerContext,
	RegionContainerContextState[]
> {
	regions: Region[];
	getRegionById(idref: string | undefined): TTMLRegion | undefined;
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
			value: inlineStyles["xml:id"] || generateSyntheticId("region-inline"),
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
			value: generateSyntheticId("region-nested"),
		},
		kind: {
			value: "nested",
			enumerable: true,
		},
	});
}

/**
 * Styles referenced by region must be already defined in the scope chain and in the document.
 * Therefore we do not need to extract them and duplicate them. We just need to check them.
 */
function validateOutOfLineStyleIDREFS(idrefs: string | undefined, scope: Scope): string[] {
	if (!idrefs?.length) {
		return [];
	}

	const styleContext = readScopeStyleContainerContext(scope);
	const errorContext = readScopeErrorContext(scope)!;

	if (!styleContext) {
		errorContext.report(
			new Error(
				`Region referenced style(s) '${idrefs}', but no out-of-line styles were defined in this document. Ignored.`,
			),
			false,
		);

		return [];
	}

	const idrefsStyleList = idrefs!.split(/\s+/);
	const referencialStyles: string[] = [];

	for (const idref of idrefsStyleList) {
		const style = styleContext.getStyleByIDRef(idref);

		if (!style) {
			errorContext.report(
				new Error(
					`Region referenced style '${idref}', but no such out-of-line style was defined in this document. Ignored.`,
				),
				false,
			);

			continue;
		}

		referencialStyles.push(idref);
	}

	return referencialStyles;
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
		if (!isAnimateOrSetElement(tokenContent)) {
			continue;
		}

		const animationId =
			tokenContent.attributes["xml:id"] || generateSyntheticId("region-animation");

		animations.push({
			ownerElement: "region",
			element: tokenContent.content,
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

	const referencialStyles = validateOutOfLineStyleIDREFS(attributes["style"], sourceScope);
	const nestedStyles = extractNestedStylesChildren(children);
	const inlineStyles = extractInlineStyles(attributes);

	const styleIds = [...referencialStyles, nestedStyles["xml:id"], inlineStyles["xml:id"]];

	const animations = extractNestedAnimationsChildren(children);

	const animationIds = animations
		.map((a) => a.attributes["xml:id"])
		.filter((id): id is string => !!id);

	/**
	 * Contexts will become isolated
	 */
	const subscope = createScope(
		sourceScope,
		createStyleContainerContext([
			//
			inlineStyles,
			nestedStyles,
		]),
		createAnimationContainerContext(
			//
			animations,
		),
		createTimeContext(regionTimingAttributes),
		createTemporalActiveContext({
			stylesIDRefs: styleIds,
			animationsIDRefs: animationIds,
		}),
	);

	const regionStyles = getRegionStylesByScope(subscope);
	const regionVisualStyles = computeRegionVisualStylesByScope(subscope);
	const regionGeometryStyles = computeRegionGeometryStylesByScope(subscope);
	const entities = getRegionEntitiesByScope(subscope, children);

	const region = new TTMLRegion(attributes["xml:id"] || "inline", subscope, regionTimingAttributes);

	region.entities = entities;
	region.styles = regionStyles;
	region.visualStyles = regionVisualStyles;
	region.geometryStyles = regionGeometryStyles;

	return region;
}

function getRegionEntitiesByScope(
	scope: Scope,
	children: NodeWithRelationship<Token & NodeWithScope>[] = [],
): Entities.AllEntities[] {
	const styles = computeRegionVisualStylesByScope(scope);

	const entities: Entities.AllEntities[] = [];

	if (Object.keys(styles).length) {
		entities.push(Entities.createLocalStyleEntity(styles));
	}

	const regionAnimations = isolateContext(readScopeAnimationContext(scope))?.animations || [];

	if (regionAnimations.length) {
		const regionTimeContext = isolateContext(readScopeTimeContext(scope))!;
		const regionStart = regionTimeContext.startTime;

		const animationChildren = children.filter(
			(c) => c.content.content === "animate" || c.content.content === "set",
		);

		for (let i = 0; i < regionAnimations.length; i++) {
			const animation = regionAnimations[i]!;
			const animationScope: Scope | undefined = animationChildren[i]?.content[nodeScopeSymbol];
			const animationTimeContext = animationScope && readScopeTimeContext(animationScope);

			if (!animationTimeContext) {
				continue;
			}

			const duration = animationTimeContext.endTime - animationTimeContext.startTime;
			const delay = animationTimeContext.startTime - regionStart;
			const styles = animation.apply("region");

			if (!Object.keys(styles).length) {
				continue;
			}

			entities.push(
				Entities.createAnimationEntity({
					id: animation.id,
					kind: animation.calcMode === "discrete" ? "discrete" : "continuous",
					duration,
					delay,
					fill: animation.fill === "freeze" ? "forwards" : "none",
					keyTimes: animation.keyTimes,
					splines: animation.keySplines,
					styles,
				}),
			);
		}
	}

	return entities;
}

function getRegionStylesByScope(scope: Scope): TTMLStyle[] {
	const styleContext = isolateContext(readScopeStyleContainerContext(scope));

	if (!styleContext) {
		return [];
	}

	return styleContext.styles;
}

const REGION_GEOMETRY_CSS_PROPERTIES = new Set([
	"x",
	"y",
	"left",
	"top",
	"width",
	"height",
	"position",
]);

export class TTMLRegion implements Region {
	public id: string;
	public timingAttributes?: TimeContextData;
	public lines: number = 2;
	public entities: Entities.AllEntities[] = [];
	public styles: TTMLStyle[] = [];
	public scope: Scope;

	public geometryStyles: Record<string, string> | undefined = undefined;
	public visualStyles: Record<string, string> | undefined = undefined;

	public constructor(id: string, scope: Scope, timingAttributes: TimeContextData | undefined) {
		this.id = id;
		this.scope = scope;
		this.timingAttributes = timingAttributes;
	}

	public getOrigin(
		_viewportWidth?: number,
		_viewportHeight?: number,
	): [x: number | string, y: number | string] {
		const styles = this.geometryStyles!;

		return [styles["x"] ?? 0, styles["y"] ?? 0];
	}

	public get width(): string {
		return this.geometryStyles?.["width"] ?? "100%";
	}

	public get height(): string | undefined {
		return this.geometryStyles?.["height"];
	}
}

function computeRegionStylesByScope(scope: Scope): Record<string, string> {
	const temporalActiveContext = isolateContext(readScopeTemporalActiveContext(scope));

	if (!temporalActiveContext) {
		return {};
	}

	return temporalActiveContext.computeStylesForElement("region");
}

function computeRegionVisualStylesByScope(scope: Scope): Record<string, string> {
	const styles = computeRegionStylesByScope(scope);

	return Object.fromEntries(
		Object.entries(styles).filter(([attr]) => !REGION_GEOMETRY_CSS_PROPERTIES.has(attr)),
	);
}

export function computeRegionGeometryStylesByScope(scope: Scope): Record<string, string> {
	const styles = computeRegionStylesByScope(scope);

	return Object.fromEntries(
		Object.entries(styles).filter(([attr]) => REGION_GEOMETRY_CSS_PROPERTIES.has(attr)),
	);
}
