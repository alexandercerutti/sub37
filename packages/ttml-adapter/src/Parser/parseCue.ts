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

		if (children.content.content === "span") {
			cues = cues.concat(getCuesFromSpan(children, attributes["xml:id"] || `unk-par-${i}`));
			continue;
		}

		if (children.content.content === "br" && cues.length) {
			processLineBreak(cues[cues.length - 1]);
			continue;
		}

		if (children.content.type === TokenType.STRING) {
			if (cues.length && cues[cues.length - 1].content === "") {
				cues[cues.length - 1].content += children.content.content;
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

		if (children.content.content === "span") {
			cues = cues.concat(getCuesFromSpan(children, parentId));
			continue;
		}

		if (children.content.content === "br") {
			processLineBreak(cues[cues.length - 1]);
			continue;
		}

		if (children.content.type === TokenType.STRING) {
			if (!cues.length) {
				cues = cues.concat(
					createCueFromAnonymousSpan(
						children,
						node.content.attributes["xml:id"] || `unk-span-${i}`,
					),
				);

				continue;
			}

			cues[cues.length - 1].content += children.content.content;

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
				region: attrs & TemporalAttributes.REGION ? temporalActiveContext.region : undefined,
				entities,
			}),
		);
	}

	return cues;
}

const TemporalAttributes = {
	CUE: /*********/ 0b001,
	REGION: /******/ 0b010,
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
	const cueTimeContext = readScopeTimeContext(scope);
	const tac = readScopeTemporalActiveContext(scope);
	const region = tac?.region;

	/**
	 * This array order is linked to the
	 * one in the categorizeTimeSegments.
	 */
	const timeItemsIntervals: [number, number][] = [
		[cueTimeContext.startTime, cueTimeContext.endTime],
	];

	if (region?.timingAttributes) {
		const regionScope = createScope(
			//
			scope,
			createTimeContext(region.timingAttributes),
		);
		const regionTimeContext = isolateContext(readScopeTimeContext(regionScope));

		timeItemsIntervals.push([regionTimeContext.startTime, regionTimeContext.endTime]);
	}

	/**
	 * @TODO add check on animation timing attributes
	 */

	const timeIntervals = categorizeTimeSegments(
		timeItemsIntervals,
		getTimeSegments(timeItemsIntervals),
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
		 * For this reason, if this case, we are returning
		 * the [0s,0s]. But one day we might decide to
		 * remove it.
		 */

		return [[timeItemsIntervals[0][0], timeItemsIntervals[0][1], TemporalAttributes.CUE]];
	}

	return activeCueTimeIntervals;
}

/**
 * Given a set of `[start, end]` intervals, expands all
 * the possible time intervals.
 *
 * @example
 *
 * Not intersecting, (2 segments)
 * ==============================================
 * ||	rst							ret cst							 cet ||
 * ||	 | ////////////// |	 |								|  ||
 * ||	 |								|	 | ////////////// |  ||
 * ==============================================
 *
 * Intersecting, region ends before cue end (3 segments)
 * =====================================
 * ||	rst				 cst	 ret				cet ||
 * ||	 | ////////////// |	 				 |	||
 * ||	 |					| ////////////// |	||
 * =====================================
 *
 * Intersecting (opposite, 3 segments)
 * =====================================
 * ||	cst				 rst	 cet				ret ||
 * ||	 |					| ////////////// |	||
 * ||	 | ////////////// |	 				 |	||
 * =====================================
 *
 *
 * @param intervals
 * @returns
 */

function getTimeSegments(
	intervals: [start: number, end: number][],
): [t0: number, t1: number, attrs: number][] {
	const timeBreakpoints = Array.from(new Set(intervals.flat())).sort((a, b) => a - b);

	const timeIntervals: [number, number, number][] = [];

	for (let i = 0; i < timeBreakpoints.length - 1; i++) {
		const t0 = timeBreakpoints[i];
		const t1 = timeBreakpoints[i + 1];

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
 * @param intervals
 * @returns
 */

function categorizeTimeSegments(
	baseTimeIntervals: [startTime: number, endTime: number][],
	intervals: TemporalIntervalList,
): TemporalIntervalList {
	const timeItemsAttributes = [TemporalAttributes.CUE, TemporalAttributes.REGION] as const;

	if (baseTimeIntervals.length > timeItemsAttributes.length) {
		throw new Error(
			"Not all the baseTimeIntervals have a matching attribute. One interval should be associated with one attribute.",
		);
	}

	for (let i = 0; i < baseTimeIntervals.length; i++) {
		const [itemStartTime, itemEndTime] = baseTimeIntervals[i];

		for (const interval of intervals) {
			const [start, end] = interval;

			if (start >= itemStartTime && end <= itemEndTime) {
				interval[2] |= timeItemsAttributes[i];
			}
		}
	}

	return intervals;
}
