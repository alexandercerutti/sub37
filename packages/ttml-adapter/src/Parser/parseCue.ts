import { CueNode, Entities, Region } from "@sub37/server";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope, isolateContext } from "./Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "./Scope/TimeContext.js";
import { readScopeTemporalActiveContext } from "./Scope/TemporalActiveContext.js";
import { nodeScopeSymbol, type NodeWithScope } from "../Adapter.js";
import type { Animation } from "./Scope/AnimationContainerContext.js";
import { TTMLRegion } from "./Scope/RegionContainerContext.js";
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
				region = createDerivedRegionWithSpecialSemanticsStyles(region, specialSemanticsStyles);
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

			/**
			 * We have a different scope, so we have to create a new CueNode
			 * derived from the existing ones.
			 */

			const spanEntities = resolveSpanEntities(childScope);
			const intervals = getCueTemporalIntervalSegments(childScope);

			for (const [startTime, endTime, attrs, activeEntities] of intervals) {
				const rootCue =
					rootCues.find((r) => r.startTime === startTime && r.endTime === endTime) ?? rootCues[0]!;

				cues.push(
					CueNode.from(rootCue, {
						id: parentId,
						content: child.content.content,
						startTime,
						endTime,
						region: rootCue.region,
						entities: spanEntities.concat(
							resolveAnimationEntities(attrs, activeEntities, startTime),
						),
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

function resolveSpanEntities(scope: Scope): Entities.AllEntities[] {
	const tac = readScopeTemporalActiveContext(scope);

	if (!tac) {
		return [];
	}

	const styles = tac.computeStylesForElement("span");

	return [Entities.createLocalStyleEntity(styles)];
}

function resolveAnimationEntities(
	attrs: number,
	activeEntities: (ResolvedAnimation | Region)[],
	intervalStart: number,
): Entities.AllEntities[] {
	if (!(attrs & ActiveTemporalEntities.ANIMATION)) {
		return [];
	}

	return activeEntities
		.filter((entity): entity is ResolvedAnimation => "startTime" in entity)
		.map((animation) =>
			Entities.createAnimationEntity({
				id: animation.id,
				duration: animation.duration,
				keyTimes: animation.keyTimes,
				fill: animation.fill === "freeze" ? "forwards" : "none",
				splines: animation.keySplines,
				kind: animation.calcMode === "discrete" ? "discrete" : "continuous",
				delay: animation.startTime - intervalStart,
				styles: animation.apply("span"),
			}),
		);
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

	const activeCueTimeIntervals = timeIntervals.filter(
		([, , attr]) => attr & ActiveTemporalEntities.CUE,
	);

	if (!activeCueTimeIntervals.length) {
		/**
		 * This could happen because we got a cue with
		 * a duration of 0s (e.g. begin of 0s and sequential
		 * timeContainer, which leads to 0s).
		 *
		 * In that case, the cue would never get rendered.
		 *
		 * So, what's the difference between emitting a cue
		 * that lasts 0s and not emitting one at all?
		 * Probably just the fact that it could get debugged
		 * and inspected and nothing else.
		 *
		 * For this reason, in this case we are returning
		 * the [0s, 0s]. But one day we might decide to
		 * remove it.
		 */

		return [
			[
				associatedTimeIntervals[0]![0],
				associatedTimeIntervals[0]![1],
				ActiveTemporalEntities.CUE,
				[],
			],
		];
	}

	return activeCueTimeIntervals;
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

function createDerivedRegionWithSpecialSemanticsStyles(
	baseRegion: TTMLRegion,
	specialSemanticsStyles: Record<string, string>,
): TTMLRegion {
	const overriddenAttributes: StyleContainerContextState = Object.create(specialSemanticsStyles, {
		"xml:id": { value: `derived:${baseRegion.id}` },
		kind: { value: "inline", enumerable: true },
	});

	const newScope = createScope(
		baseRegion.scope,
		createStyleContainerContext([overriddenAttributes]),
	);

	return new TTMLRegion(baseRegion.id, baseRegion.timingAttributes, newScope);
}
