import { CueNode, Entities } from "@sub37/server";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope, isolateContext } from "./Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "./Scope/TimeContext.js";
import { readScopeTemporalActiveContext } from "./Scope/TemporalActiveContext.js";
import { nodeScopeSymbol, type NodeWithScope } from "../Adapter.js";

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
		 * "For the purpose of determining the applicability of a style property,
		 * if the style property is defined so as to apply to a span element,
		 * then it also applies to anonymous span elements."
		 */
		const styles = temporalActiveContext.computeStylesForElement("span");

		if (Object.keys(styles).length) {
			entities.push(Entities.createLocalStyleEntity(styles));
		}
	}

	const timeIntervals = getCuesTimeIntervalsFromRegionTemporalSegmentation(scope);

	const cues: CueNode[] = [];

	for (const [startTime, endTime, attrs] of timeIntervals) {
		cues.push(
			new CueNode({
				id: parentId,
				content,
				startTime,
				endTime,
				region: attrs & TemporalAttributes.REGION ? temporalActiveContext?.region : undefined,
				entities,
			}),
		);
	}

	return cues;
}

const TemporalAttributes = {
	CUE: /*********/ 0b001,
	REGION: /******/ 0b010,
	ANIMATION: /***/ 0b100,
} as const;

type TemporalIntervalList = [startTime: number, endTime: number, attrs: number][];

/**
 * A region can specify timing attributes for which
 * its activation is elegible for.
 *
 * We have to segment the timeline and the cues
 * in order to make them activate only in that specific
 * time shift.
 */
function getCuesTimeIntervalsFromRegionTemporalSegmentation(scope: Scope): TemporalIntervalList {
	const cueTimeContext = readScopeTimeContext(scope)!;
	const tac = readScopeTemporalActiveContext(scope);
	const region = tac?.region;
	const animations = tac?.animations || [];

	/**
	 * This array order is linked to the
	 * one in the categorizeTimeSegments.
	 */
	const unlinkedTimeIntervals: TemporalIntervalList = [
		[cueTimeContext.startTime, cueTimeContext.endTime, TemporalAttributes.CUE],
	];

	if (region?.timingAttributes) {
		const regionScope = createScope(
			//
			scope,
			createTimeContext(region.timingAttributes),
		);

		const regionTimeContext = isolateContext(readScopeTimeContext(regionScope))!;

		unlinkedTimeIntervals.push([
			regionTimeContext.startTime,
			regionTimeContext.endTime,
			TemporalAttributes.REGION,
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

			unlinkedTimeIntervals.push([
				animationTimeContext.startTime,
				animationTimeContext.endTime,
				TemporalAttributes.ANIMATION,
			]);
		}
	}

	const timeIntervals = categorizeTimelineSegments(
		unlinkedTimeIntervals,
		getTimelineSegments(unlinkedTimeIntervals),
	);

	const activeCueTimeIntervals = timeIntervals.filter(
		([, , attr]) => attr & TemporalAttributes.CUE,
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

		return [[unlinkedTimeIntervals[0]![0], unlinkedTimeIntervals[0]![1], TemporalAttributes.CUE]];
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
 * **Not intersecting, (2 segments)**
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
 * @param unlinkedIntervals
 * @returns
 */

function getTimelineSegments(unlinkedIntervals: TemporalIntervalList): TemporalIntervalList {
	const timelineCuepoints = Array.from(
		new Set(unlinkedIntervals.flatMap(([start, end]) => [start, end])),
	).sort((a, b) => a - b);

	const timeIntervals: TemporalIntervalList = [];

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
	unlinkedTimeIntervals: TemporalIntervalList,
	timelineSegments: TemporalIntervalList,
): TemporalIntervalList {
	for (let i = 0; i < unlinkedTimeIntervals.length; i++) {
		const [itemStartTime, itemEndTime, attribute] = unlinkedTimeIntervals[i]!;

		for (const segment of timelineSegments) {
			const [start, end] = segment;

			if (start >= itemStartTime && end <= itemEndTime) {
				segment[2] |= attribute;
			}
		}
	}

	return timelineSegments;
}
