import { CueNode, Entities, Region } from "@sub37/server";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope, isolateContext } from "./Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "./Scope/TimeContext.js";
import { readScopeTemporalActiveContext } from "./Scope/TemporalActiveContext.js";
import { nodeScopeSymbol, type NodeWithScope } from "../Adapter.js";
import type { Animation } from "./Animations/parseAnimation.js";
import { TTMLRegion } from "./Scope/RegionContainerContext.js";

export function parseCue(node: NodeWithRelationship<Token & NodeWithScope>): CueNode[] {
	if (!node.children.length) {
		return [];
	}

	const { attributes } = node.content;

	/**
	 * @TODO handle "tts:extent" and "tts:origin" applied on paragraph
	 * element. They should be handled as an additional region, as per
	 * this section 11.1.2.1 of the standard.
	 *
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#layout-vocabulary-region-special-inline-animation-semantics
	 */

	let cues: CueNode[] = [];

	for (let i = 0; i < node.children.length; i++) {
		const children = node.children[i];

		if (children?.content.content === "span") {
			cues = cues.concat(getCuesFromSpan(children, attributes["xml:id"] || `unk-par-${i}`));
			continue;
		}

		if (children?.content.content === "br" && cues.length) {
			processLineBreak(cues[cues.length - 1]);
			continue;
		}

		if (children?.content.type === TokenType.STRING) {
			if (cues.length && cues[cues.length - 1]!.content === "") {
				cues[cues.length - 1]!.content += children.content.content;
				continue;
			}

			cues = cues.concat(
				createCueFromAnonymousSpan(children, node.content.attributes["xml:id"] || `unk-span-${i}`),
			);

			continue;
		}
	}

	const temporalActiveContext = readScopeTemporalActiveContext(node.content[nodeScopeSymbol]);

	if (temporalActiveContext) {
		const lineEntity = Entities.createLineStyleEntity(
			temporalActiveContext.computeStylesForElement("p"),
		);

		for (const cue of cues) {
			cue.entities.push(lineEntity);
		}
	}

	return cues;
}

function getCuesFromSpan(
	node: NodeWithRelationship<Token & NodeWithScope>,
	parentId: string,
): CueNode[] {
	if (!node.children.length) {
		return [];
	}

	let cues: CueNode[] = [];

	for (let i = 0; i < node.children.length; i++) {
		const children = node.children[i];

		if (children?.content.content === "span") {
			cues = cues.concat(getCuesFromSpan(children, parentId));
			continue;
		}

		if (children?.content.content === "br") {
			processLineBreak(cues[cues.length - 1]);
			continue;
		}

		if (children?.content.type === TokenType.STRING) {
			if (!cues.length) {
				cues = cues.concat(
					createCueFromAnonymousSpan(
						children,
						node.content.attributes["xml:id"] || `unk-span-${i}`,
					),
				);

				continue;
			}

			cues[cues.length - 1]!.content += children.content.content;

			continue;
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

function createCueFromAnonymousSpan(
	node: NodeWithRelationship<Token & NodeWithScope>,
	parentId: string,
): CueNode[] {
	const {
		content: { content, [nodeScopeSymbol]: scope },
	} = node;

	const temporalActiveContext = readScopeTemporalActiveContext(scope);

	const entities: Entities.AllEntities[] = [];

	if (temporalActiveContext) {
		/**
		 * > For the purpose of determining the applicability of a style property,
		 * > if the style property is defined so as to apply to a span element,
		 * > then it also applies to anonymous span elements.
		 */
		const styles = temporalActiveContext.computeStylesForElement("span");

		if (Object.keys(styles).length) {
			entities.push(Entities.createLocalStyleEntity(styles));
		}
	}

	const timeIntervals = getCuesTimeIntervalsFromRegionTemporalSegmentation(scope);

	const cues: CueNode[] = [];

	for (const [startTime, endTime, attrs, activeEntities] of timeIntervals) {
		let region: TTMLRegion | undefined;
		let activeAnimations: ResolvedAnimation[] = [];

		if (attrs & ActiveTemporalEntities.ANIMATION) {
			activeAnimations = activeAnimations.concat(
				activeEntities.filter((entity): entity is ResolvedAnimation => "startTime" in entity),
			);
		}

		if (attrs & ActiveTemporalEntities.REGION) {
			region = activeEntities.find((entity) => entity instanceof TTMLRegion);
		}

		const animationEntities = activeAnimations.map((animation) =>
			Entities.createAnimationEntity({
				id: animation.id,
				duration: animation.duration,
				keyTimes: animation.keyTimes,
				fill: animation.fill === "freeze" ? "forwards" : "none",
				splines: animation.keySplines,
				kind: animation.calcMode === "discrete" ? "discrete" : "continuous",
				delay: animation.startTime - startTime,
				styles: animation.apply("span"),
			}),
		);

		cues.push(
			new CueNode({
				id: parentId,
				content,
				startTime,
				endTime,
				region,
				entities: entities.concat(animationEntities),
			}),
		);
	}

	return cues;
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
 * A region can specify timing attributes for which
 * its activation is elegible for.
 *
 * We have to segment the timeline and the cues
 * in order to make them activate only in that specific
 * time shift.
 */
function getCuesTimeIntervalsFromRegionTemporalSegmentation(
	scope: Scope,
): TemporalIntervalWithEntities[] {
	const cueTimeContext = readScopeTimeContext(scope)!;
	const tac = readScopeTemporalActiveContext(scope);
	const region = tac?.region;
	const animations = tac?.animations || [];

	const associatedTimeIntervals: AssociatedTemporalInterval[] = [
		[cueTimeContext.startTime, cueTimeContext.endTime, ActiveTemporalEntities.CUE],
	];

	if (region?.timingAttributes) {
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

			const resolvedAnimation: ResolvedAnimation = Object.create(animation, {
				duration: {
					value: animationTimeContext.endTime - animationTimeContext.startTime,
					enumerable: true,
				},
				startTime: {
					value: animationTimeContext.startTime,
					enumerable: true,
				},
			});

			associatedTimeIntervals.push([
				animationTimeContext.startTime,
				animationTimeContext.endTime,
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
