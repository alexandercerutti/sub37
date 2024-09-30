import { CueNode, Entities } from "@sub37/server";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope } from "./Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "./Scope/TimeContext.js";
import { createStyleContainerContext } from "./Scope/StyleContainerContext.js";
import {
	createTemporalActiveContext,
	readScopeTemporalActiveContext,
} from "./Scope/TemporalActiveContext.js";

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
		createStyleContainerContext({ localStyles: attributes }),
		createTemporalActiveContext({
			stylesIDRefs: ["localStyles"],
			regionIDRef: attributes["region"],
		}),
	);

	const cues: CueNode[] = [];

	for (let i = 0; i < node.children.length; i++) {
		cues.push(...parseCueContents(attributes["xml:id"] || "unkpar", node.children, localScope));
	}

	return cues;

	// return parseCueContents(attributes["xml:id"] || "unkpar", attributes, node.children, localScope);
}

function parseCueContents(
	parentId: string,
	rootChildren: NodeWithRelationship<Token>[],
	scope: Scope,
	previousCues: CueNode[] = [],
): CueNode[] {
	let cues: CueNode[] = previousCues;
	// const cues: CueNode[] = [];

	const temporalActiveContext = readScopeTemporalActiveContext(scope);
	const timeContext = readScopeTimeContext(scope);

	for (let i = 0; i < rootChildren.length; i++) {
		const { content, children } = rootChildren[i];

		if (content.type === TokenType.STRING) {
			/**
			 * Handling Anonymous spans
			 */

			if (!cues.length) {
				cues.push(
					new CueNode({
						id: `${parentId}-anonymous-${i}`,
						content: "",
						startTime: timeContext.startTime,
						endTime: timeContext.endTime,

						/** @TODO Fix region association */
						region: undefined,
						// entities: styles.map((style) => Entities.createStyleEntity(style.attributes)),
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

			let nextCueID = attributes["xml:id"] || `${parentId}-${i}`;

			if (isTimestamp(attributes)) {
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

			if (children.length) {
				cues.push(...parseCue(rootChildren[i], localScope));
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
