import type { TimeDetails } from "./TimeBase";
import { CueNode } from "@sub37/server";
import { getTimeBaseProvider } from "./TimeBase/index.js";
import { matchClockTimeExpression } from "./TimeExpressions/matchers/clockTime.js";
import { matchOffsetTimeExpression } from "./TimeExpressions/matchers/offsetTime.js";
import { matchWallClockTimeExpression } from "./TimeExpressions/matchers/wallclockTime.js";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope } from "./Scope/Scope.js";
import {
	createTimeContext,
	isTimeContainerStardardString,
	readScopeTimeContext,
} from "./Scope/TimeContext.js";
import { createRegionContext, readScopeRegionContext } from "./Scope/RegionContext.js";

export function parseCue(
	node: NodeWithRelationship<Token>,
	scope: Scope,
	documentSettings: TimeDetails,
): CueNode[] {
	const { attributes } = node.content;

	const timeContainer = isTimeContainerStardardString(attributes["timeContainer"])
		? attributes["timeContainer"]
		: undefined;

	const regionTokens: { region: Token; children: NodeWithRelationship<Token>[] }[] = [];

	for (const { content, children } of node.children) {
		if (content.content === "region") {
			regionTokens.push({ region: content, children });
		}
	}

	const localScope = createScope(
		scope,
		createTimeContext({
			begin: parseTimeString(attributes["begin"], documentSettings),
			dur: parseTimeString(attributes["dur"], documentSettings),
			end: parseTimeString(attributes["end"], documentSettings),
			timeContainer: timeContainer,
		}),
		createRegionContext(regionTokens),
	);

	return parseCueContents(
		attributes["xml:id"] || "unkpar",
		attributes["region"],
		node.children,
		localScope,
		documentSettings,
	);
}

function parseCueContents(
	parentId: string,
	parentRegionId: string,
	rootChildren: NodeWithRelationship<Token>[],
	scope: Scope,
	documentSettings: TimeDetails,
	previousCues: CueNode[] = [],
): CueNode[] {
	let cues: CueNode[] = previousCues;
	const timeContext = readScopeTimeContext(scope);
	const regionContext = readScopeRegionContext(scope);

	const matchingRegion = parentRegionId
		? regionContext.regions.find((region) => region.id === parentRegionId)
		: undefined;

	for (let i = 0; i < rootChildren.length; i++) {
		const { content, children } = rootChildren[i];

		if (content.type === TokenType.STRING) {
			/**
			 * Handling Anonymous spans
			 */

			if (!cues.length || cues[cues.length - 1].id !== parentId) {
				cues.push(
					new CueNode({
						id: `${parentId}-anonymous-${i}`,
						content: "",
						startTime: timeContext.startTime,
						endTime: timeContext.endTime,
						region: matchingRegion,
					}),
				);
			}

			cues[cues.length - 1].content += content.content;

			continue;
		}

		if (content.content === "span") {
			const { attributes } = content;

			const timeContainer = isTimeContainerStardardString(attributes["timeContainer"])
				? attributes["timeContainer"]
				: undefined;

			const localScope = createScope(
				scope,
				createTimeContext({
					begin: parseTimeString(attributes["begin"], documentSettings),
					dur: parseTimeString(attributes["dur"], documentSettings),
					end: parseTimeString(attributes["end"], documentSettings),
					timeContainer,
				}),
			);

			const timeContext = readScopeTimeContext(localScope);
			const regionContext = readScopeRegionContext(localScope);

			let nextCueID = attributes["xml:id"] || `${parentId}-${i}`;
			const matchingRegion = attributes["region"]
				? regionContext.regions.find((region) => region.id === attributes["region"])
				: undefined;

			if (isTimestamp(attributes)) {
				cues.push(
					new CueNode({
						id: nextCueID,
						content: "",
						startTime: timeContext.startTime,
						endTime: timeContext.endTime,
						region: matchingRegion,
					}),
				);
			}

			if (children.length) {
				cues = parseCueContents(
					nextCueID,
					attributes["region"],
					children,
					localScope,
					documentSettings,
					cues,
				);
			}

			continue;
		}
	}

	return cues;
}

export function parseTimeString(timeString: string, timeDetails: TimeDetails): number | undefined {
	if (!timeString) {
		return undefined;
	}

	const timeProvider = getTimeBaseProvider(timeDetails["ttp:timeBase"]);

	{
		const match = matchClockTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByClockTime(match, timeDetails);
		}
	}

	{
		const match = matchOffsetTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByOffsetTime(match, timeDetails);
		}
	}

	{
		const match = matchWallClockTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByWallClockTime(match);
		}
	}

	/**
	 * @TODO improve error type here
	 */

	throw new Error(
		"Time format didn't match any supported format (ClockTime, OffsetTime or WallClock);",
	);
}

function isTimestamp(attributes: Record<string, string>): boolean {
	return (
		typeof attributes["begin"] !== "undefined" &&
		typeof attributes["end"] === "undefined" &&
		typeof attributes["dur"] === "undefined"
	);
}
