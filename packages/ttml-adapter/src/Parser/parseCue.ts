import { CueNode, Entities } from "@sub37/server";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope } from "./Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "./Scope/TimeContext.js";
import {
	createRegionContext,
	readScopeRegionContext,
	findInlineRegionInChildren,
} from "./Scope/RegionContext.js";
import { readScopeStyleContext } from "./Scope/StyleContext.js";
import type { TTMLStyle } from "./parseStyle.js";

export function parseCue(node: NodeWithRelationship<Token>, scope: Scope): CueNode[] {
	const { attributes } = node.content;

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
		createRegionContext(
			findInlineRegionInChildren(node.content.attributes["xml:id"], node.children),
		),
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

	for (let i = 0; i < rootChildren.length; i++) {
		const { content, children } = rootChildren[i];

		if (content.type === TokenType.STRING) {
			/**
			 * Handling Anonymous spans
			 */

			if (!cues.length) {
				let styles: TTMLStyle[] = [];

				const linkedRegion = regionContext.getRegionsById(parentAttributes?.["region"])[0];

				/**
				 * 11.3.1.2 Inline Regions
				 *
				 * When an attribute "region" is available on a block element,
				 * inline regions should be ignored.
				 */

				if (!linkedRegion) {
					const contextualRegions = regionContext.getRegionsById("contextual");

					styles.push({
						id: "contextual",
						get attributes() {
							return Object.assign({}, ...contextualRegions.map((region) => region.styles));
						},
					});
				}

				cues.push(
					new CueNode({
						id: `${parentId}-anonymous-${i}`,
						content: "",
						startTime: timeContext.startTime,
						endTime: timeContext.endTime,
						region: linkedRegion,
						entities: styles.map((style) => Entities.createStyleEntity(style.attributes)),
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
						entities: cues[cues.length - 1]?.entities,
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
