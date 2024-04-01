import { CueNode } from "@sub37/server";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope } from "./Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "./Scope/TimeContext.js";
import {
	type RegionContextState,
	createRegionContext,
	readScopeRegionContext,
} from "./Scope/RegionContext.js";
import { createStyleContext, readScopeStyleContext } from "./Scope/StyleContext.js";

export function parseCue(node: NodeWithRelationship<Token>, scope: Scope): CueNode[] {
	const { attributes } = node.content;

	const regionTokens: RegionContextState[] = [];

	for (const { content, children } of node.children) {
		if (content.content !== "region") {
			continue;
		}

		/**
		 * 8.1.5 p
		 *
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#content-vocabulary-p
		 *
		 * Paragraph element is defined to have up to one
		 * region element inside of it (Kleene operators)
		 *
		 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#conventions
		 */

		regionTokens.push({
			attributes: Object.create(content.attributes, {
				"xml:id": {
					value: "contextual",
				},
			}),
			children,
		});

		break;
	}

	/**
	 * @TODO handle "tts:extent" and "tts:origin" applied on paragraph
	 * element. They should be handled as an additional region, as per
	 * this section 11.1.2.1 of the standard.
	 *
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#layout-vocabulary-region-special-inline-animation-semantics
	 */

	const localScope = createScope(
		scope,
		createTimeContext({
			begin: attributes["begin"],
			dur: attributes["dur"],
			end: attributes["end"],
			timeContainer: attributes["timeContainer"],
		}),
		createRegionContext(regionTokens),
	);

	return parseCueContents(attributes["xml:id"] || "unkpar", attributes, node.children, localScope);
}

function parseCueContents(
	parentId: string,
	parentAttributes: Record<string, string> = {},
	rootChildren: NodeWithRelationship<Token>[],
	scope: Scope,
	previousCues: CueNode[] = [],
): CueNode[] {
	let cues: CueNode[] = previousCues;
	const timeContext = readScopeTimeContext(scope);
	const regionContext = readScopeRegionContext(scope);

	const matchingRegion = parentAttributes?.["region"]
		? regionContext.regions.find((region) => region.id === parentAttributes["region"])
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

		if (content.content === "br") {
			if (cues.length) {
				cues[cues.length - 1].content += "\n";
			}

			continue;
		}

		if (content.content === "span") {
			const { attributes } = content;

			const localScope = createScope(
				scope,
				createTimeContext({
					begin: attributes["begin"],
					dur: attributes["dur"],
					end: attributes["end"],
					timeContainer: attributes["timeContainer"],
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
				cues = parseCueContents(nextCueID, attributes, children, localScope, cues);
			}

			continue;
		}
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
