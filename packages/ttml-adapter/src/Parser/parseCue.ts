import { CueNode, Entities, Region } from "@sub37/adapter-utils";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope, isolateContext } from "./Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "./Scope/TimeContext.js";
import type { ComputedCssProperties } from "./Scope/TemporalActiveContext.js";
import { readScopeTemporalActiveContext } from "./Scope/TemporalActiveContext.js";
import { nodeScopeSymbol, type NodeWithScope } from "../Adapter.js";
import type { Animation } from "./Scope/AnimationContainerContext.js";
import { computeRegionGeometryStylesByScope, TTMLRegion } from "./Scope/RegionContainerContext.js";
import { isStyleAttribute } from "./parseStyle.js";
import type { SupportedTTMLAttributes } from "./parseStyle.js";
import { createStyleContainerContext } from "./Scope/StyleContainerContext.js";
import type { StyleContainerContextState } from "./Scope/StyleContainerContext.js";

export function parseCue(node: NodeWithRelationship<Token & NodeWithScope>): CueNode[] {
	if (!node.children.length) {
		return [];
	}

	const { attributes } = node.content;
	const parentId = attributes["xml:id"] || "unk-par";
	const scope = node.content[nodeScopeSymbol];

	const temporalActiveContext = readScopeTemporalActiveContext(scope);
	const lineEntity = temporalActiveContext
		? Entities.createLineStyleEntity(temporalActiveContext.computeStylesForElement("p"))
		: undefined;

	/**
	 * Build the root cue prototypes from <p>'s own timing/region segmentation.
	 * All child fragments will be derived from these via CueNode.from, so they
	 * can be merged in the same lines in the renderer.
	 */

	const rootIntervals = getCueTemporalIntervalSegments(scope);
	const rootCues: CueNode[] = rootIntervals.map(([startTime, endTime, attrs, activeEntities]) => {
		let region: TTMLRegion | undefined;

		if (attrs & ActiveTemporalEntities.REGION) {
			region = activeEntities.find((entity) => entity instanceof TTMLRegion);

			const specialSemanticsStyles = getSpecialSemanticsStylesFromAnchestors(node);

			if (region && Object.keys(specialSemanticsStyles).length) {
				region = createDerivedRegionWithSpecialSemanticsStyles(
					region,
					specialSemanticsStyles,
					scope,
				);
			}
		}

		const rootCue = new CueNode({
			id: parentId,
			content: "",
			startTime,
			endTime,
			region,
			entities: lineEntity ? [lineEntity] : [],
		});

		return rootCue;
	});

	return processChildren(node, parentId, node.content[nodeScopeSymbol], rootCues);
}

function processChildren(
	node: NodeWithRelationship<Token & NodeWithScope>,
	parentId: string,
	lastScopeParent: Scope | undefined,
	rootCues: CueNode[],
): CueNode[] {
	let cues: CueNode[] = [];
	let currentScopeParent: Scope | undefined = lastScopeParent;

	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];

		if (!child) {
			continue;
		}

		if (child.content.content === "span") {
			cues = cues.concat(
				processChildren(
					child,
					child.content.attributes["xml:id"] || parentId,
					currentScopeParent,
					rootCues,
				),
			);

			currentScopeParent = undefined;
			continue;
		}

		if (child.content.content === "br") {
			processLineBreak(cues[cues.length - 1]);
			continue;
		}

		if (child.content.type === TokenType.STRING) {
			const childScopeParent = child.content[nodeScopeSymbol].parent;
			const childScope = child.content[nodeScopeSymbol];

			if (cues.length && childScopeParent === currentScopeParent) {
				cues[cues.length - 1]!.content += child.content.content;
				continue;
			}

			const rawIntervals = getCueTemporalIntervalSegments(childScope);
			const spanStyles = getStylesForSpanElement(childScope);
			const displayValue = spanStyles["display"];

			/**
			 * When we are aware that an element will appear later because of a
			 * `set` animation (e.g. `<set tts:display="..."`), we cannot render it
			 * with a CSS `display: none`, because CSS is not able to animate an element
			 * that it not rendered in the CSSOM.
			 *
			 * This means that we need to change the actual render timing of the CueNode
			 * in order to make it appear exactly when the animation starts and make it
			 * disappear when the animation ends (if the animation is not `fill=freeze`-ed).
			 *
			 * This also means that we have to strip the display property from
			 * the entities.
			 */

			const intervals =
				displayValue === "none"
					? getSpanVisibilityIntervalsFromAnimations(rawIntervals)
					: rawIntervals;

			if (!intervals.length) {
				continue;
			}

			const [spanStart] = intervals[0]!;
			const spanEnd = intervals[intervals.length - 1]![1];

			const stylesWithoutDisplay: ComputedCssProperties =
				displayValue === "none"
					? Object.create(spanStyles, {
							display: {
								value: undefined,
							},
						})
					: spanStyles;

			const spanEntities: Entities.AllEntities[] = [
				Entities.createLocalStyleEntity(stylesWithoutDisplay),
			];

			/**
			 * Of all the root cues - which define the temporal window covered by
			 * the parent <p>, in which does the current span fit in?
			 */

			for (const rootCue of rootCues) {
				/**
				 * When a span doesn't have a start time or a duration,
				 * we have to fallback to the rootCue's start time and end time.
				 */
				const actualSpanStart = Math.max(spanStart, rootCue.startTime);
				const actualSpanEnd = Math.min(spanEnd, rootCue.endTime);

				if (actualSpanStart >= actualSpanEnd) {
					continue;
				}

				let animationEntities: Entities.AllEntities[] = [];

				for (const [start, end, attrs, activeEntities] of intervals) {
					if (!(attrs & ActiveTemporalEntities.ANIMATION)) {
						continue;
					}

					if (start < actualSpanEnd && end > actualSpanStart) {
						animationEntities = animationEntities.concat(
							resolveAnimationEntities(attrs, activeEntities, actualSpanStart),
						);
					}
				}

				let spanRegion: TTMLRegion | undefined;

				for (const [, , attrs, activeEntities] of intervals) {
					if (attrs & ActiveTemporalEntities.REGION) {
						spanRegion = activeEntities.find((e): e is TTMLRegion => e instanceof TTMLRegion);
						break;
					}
				}

				cues.push(
					CueNode.from(rootCue, {
						id: parentId,
						content: child.content.content,
						startTime: actualSpanStart,
						endTime: actualSpanEnd,
						region: spanRegion ?? rootCue.region,
						entities: spanEntities.concat(animationEntities),
					}),
				);
			}

			currentScopeParent = childScopeParent;
		}
	}

	return cues;
}

function processLineBreak(cue: CueNode | undefined): void {
	if (!cue) {
		return;
	}

	cue.content += "\n";
}

function getStylesForSpanElement(scope: Scope): ComputedCssProperties {
	const tac = readScopeTemporalActiveContext(scope);

	if (!tac) {
		return {};
	}

	return tac.computeStylesForElement("span");
}

function resolveAnimationEntities(
	attrs: number,
	activeEntities: (ResolvedAnimation | Region)[],
	intervalStart: number,
): Entities.AllEntities[] {
	if (!(attrs & ActiveTemporalEntities.ANIMATION)) {
		return [];
	}

	return activeEntities.reduce((acc, entity) => {
		if (!("startTime" in entity)) {
			return acc;
		}

		const styles = entity.apply("span");

		if (!Object.keys(styles).length) {
			return acc;
		}

		const animationEntity = Entities.createAnimationEntity({
			id: entity.id,
			duration: entity.duration,
			keyTimes: entity.keyTimes,
			fill: entity.fill === "freeze" ? "forwards" : "none",
			splines: entity.keySplines,
			kind: entity.calcMode === "discrete" ? "discrete" : "continuous",
			delay: entity.startTime - intervalStart,
			styles,
		});

		acc.push(animationEntity);
		return acc;
	}, [] as Entities.AllEntities[]);
}

function getSpanVisibilityIntervalsFromAnimations(
	intervals: TemporalIntervalWithEntities[],
): TemporalIntervalWithEntities[] {
	const result: TemporalIntervalWithEntities[] = [];

	for (const [start, end, attrs, activeEntities] of intervals) {
		if (!(attrs & ActiveTemporalEntities.ANIMATION)) {
			continue;
		}

		/**
		 * The dominant animation is the one, among several, that has
		 * the highest start time.
		 *
		 * That's the case of something like this:
		 *
		 * ```xml
		 * <span tts:display="none">
		 *   <set begin="2s" tts:display="block"/>
		 *   <set begin="5s" tts:display="none"/>
		 *   ...
		 * </span>
		 * ```
		 *
		 * In this case, an interval segment it made of [2s, 5s] with two
		 * active animations, but the dominant one is the second, which
		 * makes the span disappear at 5s.
		 */
		let dominant: ResolvedAnimation | undefined;

		for (const entity of activeEntities) {
			if (!("startTime" in entity)) {
				continue;
			}

			const styles = entity.apply("span");

			if (!styles["display"]?.length) {
				continue;
			}

			if (!dominant || entity.startTime > dominant.startTime) {
				dominant = entity;
			}
		}

		if (!dominant) {
			continue;
		}

		const dominantDisplayValues = dominant.apply("span")["display"]!;
		const lastValue = dominantDisplayValues[dominantDisplayValues.length - 1];

		if (lastValue === "none") {
			continue;
		}

		const entitiesWithoutDisplay = activeEntities.filter(
			(entity) => !("startTime" in entity) || !("display" in entity.apply("span")),
		);

		result.push([start, end, attrs, entitiesWithoutDisplay]);
	}

	return result;
}

const ActiveTemporalEntities = {
	CUE: /*********/ 0b001,
	REGION: /******/ 0b010,
	ANIMATION: /***/ 0b100,
} as const;

/**
 * Describes a temporal interval in which some specific entities are active.
 */
type TemporalInterval = [startTime: number, endTime: number, activeEntities: number];

type ResolvedAnimation = Omit<Animation, "timingAttributes"> & {
	duration: number;
	/**
	 * When splitting an animation across different cues, we cannot restart it
	 * for each cue. We have to resume it.
	 */
	startTime: number;
};

/**
 * Describes a temporal interval specifically associated with one entity.
 */
type AssociatedTemporalInterval = [...TemporalInterval, entity?: ResolvedAnimation | Region];

type TemporalIntervalWithEntities = [
	...TemporalInterval,
	entitiesList: (ResolvedAnimation | Region)[],
];

/**
 * Regions and animations can specify timing attributes
 * their activation is elegible for.
 *
 * Segmenting timeline is required to determine when a
 * cue is active and which entities are active within its active duration.
 *
 * It is useless to get segments there Cues are not active but regions or
 * animations are.
 */
function getCueTemporalIntervalSegments(scope: Scope): TemporalIntervalWithEntities[] {
	const cueTimeContext = readScopeTimeContext(scope)!;
	const tac = readScopeTemporalActiveContext(scope);
	const region = tac?.region;
	const animations = tac?.animations || [];

	const associatedTimeIntervals: AssociatedTemporalInterval[] = [
		[cueTimeContext.startTime, cueTimeContext.endTime, ActiveTemporalEntities.CUE],
	];

	if (region) {
		const regionScope = createScope(
			//
			scope,
			createTimeContext(region.timingAttributes),
		);

		const regionTimeContext = isolateContext(readScopeTimeContext(regionScope))!;

		associatedTimeIntervals.push([
			regionTimeContext.startTime,
			regionTimeContext.endTime,
			ActiveTemporalEntities.REGION,
			region,
		]);
	}

	if (animations.length) {
		for (const animation of animations) {
			if (!animation.timingAttributes) {
				continue;
			}

			const animationScope = createScope(
				//
				scope,
				createTimeContext(animation.timingAttributes),
			);

			const animationTimeContext = isolateContext(readScopeTimeContext(animationScope))!;

			/**
			 * Inline animation timing (begin/dur/end) is relative to the parent time container.
			 * `cueTimeContext.startTime` is the parent's absolute document start time.
			 * We must offset by it to obtain absolute document times.
			 *
			 * Example:
			 * ```xml
			 * <p begin="3s" dur="5s">
			 * 	<set begin="1s" />
			 * 	...
			 * ```
			 *
			 * |            -----               |  Time                                    |
			 * |--------------------------------|------------------------------------------|
			 * | animationTimeContext.startTime |  1000ms (relative)                       |
			 * | cueTimeContext.startTime       |  3000ms (absolute parent start)          |
			 * | absolute animation start       |  4000ms                                  |
			 * | CSS delay relative to cue      | +1000ms  (appears 1s into the paragraph) |
			 */
			const absoluteAnimStart = cueTimeContext.startTime + animationTimeContext.startTime;

			/**
			 * If the <set> has no dur/end, it runs until the parent time container ends
			 * (TTML/SMIL semantics). The TimeContext returns Infinity in that case.
			 * Clamp to the parent's end time so the CSS duration is always finite.
			 *
			 * TTML2 §12.4 Timing Semantics (normative):
			 * > The implicit duration of an `animate`, `audio`, `br`, `image`, or `set` element
			 * > is defined to be the same as if that element were treated as an anonymous span.
			 * > The implicit duration of an anonymous span [in a `par` container] is equivalent
			 * > to the `indefinite` duration value as defined by [SMIL 3.0].
			 *
			 * @see https://w3c.github.io/ttml2/#semantics-timing
			 */
			const relativeEnd = animationTimeContext.endTime;

			const absoluteAnimEnd = Number.isFinite(relativeEnd)
				? cueTimeContext.startTime + relativeEnd
				: cueTimeContext.endTime;

			const resolvedAnimation: ResolvedAnimation = Object.create(animation, {
				duration: {
					value: absoluteAnimEnd - absoluteAnimStart,
					enumerable: true,
				},
				startTime: {
					value: absoluteAnimStart,
					enumerable: true,
				},
			});

			associatedTimeIntervals.push([
				absoluteAnimStart,
				absoluteAnimEnd,
				ActiveTemporalEntities.ANIMATION,
				resolvedAnimation,
			]);
		}
	}

	const timeIntervals = categorizeTimelineSegments(
		associatedTimeIntervals,
		getTimelineSegments(associatedTimeIntervals),
	);

	/**
	 * For §11.1.2:
	 *
	 * > [...] a region that is temporally inactive must not produce any
	 * > visible marks when presented on a visual medium.
	 *
	 * During ISD construction, in §11.3.1.3:
	 *
	 * > For each temporally active region R, replicate the sub-tree [...]
	 * > evaluating this sub-tree in a postorder traversal, prune elements if [...]
	 * > - they are temporally inactive;
	 *
	 * So, these are the temporal active cues intervals.
	 */
	return timeIntervals.filter(([, , attr]) => {
		if (region && !(attr & ActiveTemporalEntities.REGION)) {
			return false;
		}

		return Boolean(attr & ActiveTemporalEntities.CUE);
	});
}

/**
 * Given a set of `[start, end, attrs]` intervals, produces
 * a set of (possibly overlapping) segments for a timeline.
 *
 * @example
 *
 * - `cst`: cue start time
 * - `cet`: cue end time
 * - `rst`: region start time
 * - `ret`: region end time
 *
 * **Not intersecting (2 segments)**
 *
 * ```text
 *  rst         ret cst        cet
 *   | ///////// |	 |           |
 *   |           |	 | ///////// |
 * ------------------------------------>
 *             timeline
 * ```
 *
 *
 * **Intersecting, region ends before cue end (3 segments)**
 *
 * ```text
 *  rst        cst   ret        cet
 *   | ////////////// |          |
 *   |          | ////////////// |
 * ------------------------------------>
 *             timeline
 * ```
 *
 * **Intersecting (opposite, 3 segments)**
 *
 * ```text
 *  cst        rst   cet        ret
 *   |          | ////////////// |
 *   | ////////////// |          |
 * ------------------------------------>
 *              timeline
 * ```
 *
 * @param associatedTemporalIntervals
 * @returns
 */

function getTimelineSegments(
	associatedTemporalIntervals: AssociatedTemporalInterval[],
): TemporalInterval[] {
	const timelineCuepoints = Array.from(
		new Set(associatedTemporalIntervals.flatMap(([start, end]) => [start, end])),
	).sort((a, b) => a - b);

	const timeIntervals: TemporalInterval[] = [];

	for (let i = 0; i < timelineCuepoints.length - 1; i++) {
		const t0 = timelineCuepoints[i]!;
		const t1 = timelineCuepoints[i + 1]!;

		timeIntervals.push([t0, t1, 0]);
	}

	return timeIntervals;
}

/**
 * Associates a segment with an attribute.
 * A segment might contain multiple attributes.
 * E.g. a segment might belong to a cue associated
 * with a region, or just the region but not the
 * cue.
 *
 * @param timelineSegments
 * @returns
 */

function categorizeTimelineSegments(
	associatedTemporalIntervals: AssociatedTemporalInterval[],
	timelineSegments: TemporalInterval[],
): TemporalIntervalWithEntities[] {
	const segments: TemporalIntervalWithEntities[] = [];

	for (const [start, end] of timelineSegments) {
		let activeFlags = 0;
		const activeEntitiesList: TemporalIntervalWithEntities[3] = [];

		for (const interval of associatedTemporalIntervals) {
			const [itemStartTime, itemEndTime, activeEntities, entity] = interval;

			if (start >= itemStartTime && end <= itemEndTime) {
				activeFlags |= activeEntities;

				if (entity !== undefined) {
					activeEntitiesList.push(entity);
				}
			}
		}

		segments.push([start, end, activeFlags, activeEntitiesList]);
	}

	return segments;
}

const SPECIAL_SEMANTICS_STYLES: SupportedTTMLAttributes[] = [
	"tts:extent",
	"tts:origin",
	"tts:position",
	"tts:disparity",
];

/**
 * Filters out attributes belonging to standard point §11.1.2.1, "Special Semantics of Inline Animation",
 * which says that certain styles assigned to "p" and "div" should be actually applied to the region
 * they flow in.
 *
 * Walks up starting from a paragraph ("p") node, up to all the divs ancestors and collects all the
 * styles attributes.
 *
 * We are not directly implementing a set animation, because - since the new region we have to create
 * applies these styles only for the same time span as the cue, we can just apply these styles as
 * inline styles on the cue itself.
 *
 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#layout-vocabulary-region-special-inline-animation-semantics
 *
 * @param attributes
 * @returns
 */
function getSpecialSemanticsStylesFromAnchestors(
	node: NodeWithRelationship<Token & NodeWithScope>,
): Record<string, string> {
	const styles: Record<string, string> = {};

	const allowedParents = ["p", "div", "span"];

	let parent: NodeWithRelationship<Token & NodeWithScope> | null = node;

	while (parent && allowedParents.includes(parent.content.content)) {
		if (parent.content.content === "span") {
			/**
			 * The special semantics (§11.1.2.1) only apply to "p" and "div" elements.
			 */

			parent = parent.parent ?? null;
			continue;
		}

		const parentAttributes = parent.content.attributes;

		for (const attr in parentAttributes) {
			if (!isStyleAttribute(attr)) {
				continue;
			}

			if (SPECIAL_SEMANTICS_STYLES.includes(attr as SupportedTTMLAttributes)) {
				if (!(attr in styles)) {
					styles[attr] = parentAttributes[attr]!;
				}
			}
		}

		parent = parent.parent ?? null;
	}

	return styles;
}

/**
 * §11.1.2.1 — Special Semantics of Inline Animation:
 *
 * > The original extent of the region is retained, but the child animation
 * > overrides this extent during the indicated time interval, thus producing
 * > an effect of (temporarily) changing the extent of the region as desired.
 *
 * The base region's styles, entities and visual properties are preserved.
 * Only the geometry (origin, extent, position, disparity) is overridden for
 * the cue's active interval.
 *
 * @see https://www.w3.org/TR/ttml2/#layout-vocabulary-region-special-inline-animation-semantics
 */
function createDerivedRegionWithSpecialSemanticsStyles(
	baseRegion: TTMLRegion,
	specialSemanticsStyles: Record<string, string>,
	scope: Scope,
): TTMLRegion {
	const overriddenAttributes: StyleContainerContextState = Object.create(specialSemanticsStyles, {
		"xml:id": {
			value: `derived:${baseRegion.id}`,
		},
		kind: {
			value: "inline",
			enumerable: true,
		},
	});

	const newScope = createScope(
		//
		scope,
		createStyleContainerContext([overriddenAttributes]),
	);

	const newGeometryStyles = Object.assign(
		baseRegion.geometryStyles ?? {},
		computeRegionGeometryStylesByScope(newScope),
	);

	const region = new TTMLRegion(baseRegion.id, baseRegion.scope, baseRegion.timingAttributes);

	region.entities = baseRegion.entities;
	region.styles = baseRegion.styles;
	region.geometryStyles = newGeometryStyles;

	return region;
}
