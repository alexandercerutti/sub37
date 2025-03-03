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

	const scope = node.content[nodeScopeSymbol];

	let cues: CueNode[] = [];
	const { attributes } = node.content;

	const nextCueID = attributes["xml:id"] || parentId;

	if (isTimestamp(attributes)) {
		const timeContext = readScopeTimeContext(scope);

		cues.push(
			new CueNode({
				id: nextCueID,
				content: "",
				startTime: timeContext.startTime,
				endTime: timeContext.endTime,
				/** @TODO Fix region association */
				// region: matchingRegion,
				entities: cues[cues.length - 1]?.entities,
			}),
		);
	}

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

	for (const [startTime, endTime, isRegion] of timeIntervals) {
		cues.push(
			new CueNode({
				id: parentId,
				content,
				startTime,
				endTime,
				region: isRegion ? temporalActiveContext.region : undefined,
				entities,
			}),
		);
	}

	return cues;
}

function isTimestamp(attributes: Record<string, string>): boolean {
	return (
		typeof attributes["begin"] !== "undefined" &&
		typeof attributes["end"] === "undefined" &&
		typeof attributes["dur"] === "undefined"
	);
}

type TemporalIntervalList = [startTime: number, endTime: number, isRegion: 0 | 1][];

/**
 * A region can specify timing attributes for which
 * its activation is elegible for.
 *
 * We have to segment the timeline and the cues
 * in order to make them activate only in that specific
 * time shift.
 */
function getCuesTimeIntervalsFromRegionTemporalSegmentation(scope: Scope): TemporalIntervalList {
	const tac = readScopeTemporalActiveContext(scope);
	const region = tac?.region;

	if (!region?.timingAttributes) {
		const cueTimeContext = readScopeTimeContext(scope);

		return [[cueTimeContext.startTime, cueTimeContext.endTime, 0]];
	}

	const regionScope = createScope(
		//
		scope,
		createTimeContext(region.timingAttributes),
	);

	const regionTimeContext = isolateContext(readScopeTimeContext(regionScope));
	const cueTimeContext = readScopeTimeContext(scope);

	return getTimeIntervalsByTimeContexts(regionTimeContext, cueTimeContext);
}

type TimeContext = ReturnType<typeof readScopeTimeContext>;

function getTimeIntervalsByTimeContexts(
	regionTimeContext: TimeContext,
	cueTimeContext: TimeContext,
): TemporalIntervalList {
	const regionStartTime = regionTimeContext.startTime;
	const regionEndTime = regionTimeContext.endTime;

	const cueStartTime = cueTimeContext.startTime;
	const cueEndTime = cueTimeContext.endTime;

	/**
	 * Not intersecting:
	 * ===========================================
	 * ||	rst							ret cst								||
	 * ||	 | ////////////// |	 |								||
	 * ||	 |								|	 | ////////////// ||
	 * ===========================================
	 *
	 * Intersecting:
	 * =====================================
	 * ||	rst				 cst	 ret				cet ||
	 * ||	 | ////////////// |	 				 |	||
	 * ||	 |					| ////////////// |	||
	 * =====================================
	 */

	/** */
	const cueIntersectsRegionActivationTime = regionEndTime > cueStartTime;

	if (!cueIntersectsRegionActivationTime) {
		return [[cueStartTime, cueEndTime, 0]];
	}

	let timeIntervals: TemporalIntervalList = [];

	if (regionStartTime > cueStartTime) {
		/**
		 *  |-----|...
		 * cst   rst
		 */

		timeIntervals.push(
			//
			[cueStartTime, regionStartTime, 0],
		);

		if (regionEndTime < cueEndTime) {
			/**
			 *  |:::::|----|-----|
			 * cst   rst  ret   cet
			 */

			timeIntervals.push(
				//
				[regionStartTime, regionEndTime, 1],
				[regionEndTime, cueEndTime, 0],
			);
		} else {
			/**
			 *  |:::::|-------|
			 * cst   rst  ret>=cet
			 */

			timeIntervals.push(
				//
				[regionStartTime, cueEndTime, 1],
			);
		}

		return timeIntervals;
	}

	if (regionStartTime === cueStartTime) {
		if (regionEndTime < cueEndTime) {
			/**
			 * Two segments:
			 *
			 *    |------|-----|
			 * rst=cst  ret   cet
			 */

			timeIntervals.push(
				//
				[regionStartTime, regionEndTime, 1],
				[regionEndTime, cueEndTime, 0],
			);
		} else {
			/**
			 * One segment:
			 *
			 *    |----------|
			 * rst=cst   ret>=cet
			 */

			timeIntervals.push([regionStartTime, cueEndTime, 1]);
		}

		return timeIntervals;
	}

	// ofc, rst < cst
	if (regionEndTime < cueEndTime) {
		/**
		 *  |-----|-----|-----|
		 * cst   rst   ret   cet
		 */

		timeIntervals.push(
			[cueStartTime, regionStartTime, 0],
			[regionStartTime, regionEndTime, 1],
			[regionEndTime, cueEndTime, 0],
		);
	} else {
		/**
		 *  |-----|--------|
		 * cst   rst   ret>=cet
		 */

		timeIntervals.push(
			//
			[cueStartTime, cueEndTime, 1],
		);
	}

	if (!timeIntervals.length) {
		return [[cueStartTime, cueEndTime, 0]];
	}

	return timeIntervals;
}
