import { CueNode } from "@sub37/server";
import type { NodeWithRelationship } from "./Tags/NodeTree.js";
import { TokenType, type Token } from "./Token.js";
import { type Scope, createScope } from "./Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "./Scope/TimeContext.js";
import {
	createTemporalActiveContext,
	readScopeTemporalActiveContext,
} from "./Scope/TemporalActiveContext.js";
import type { AdditionalStyle } from "./Scope/TemporalActiveContext.js";
import { createStyleParser } from "./parseStyle.js";

export function parseCue(node: NodeWithRelationship<Token>, scope: Scope): CueNode[] {
	if (!node.children.length) {
		return [];
	}

	const { attributes } = node.content;
	const styleParser = createStyleParser(scope);

	styleParser.process(
		Object.create(attributes, {
			"xml:id": {
				value: "inline",
				enumerable: true,
			},
		}),
	);

	const inlineStyle = Object.create(styleParser.get("inline"), {
		kind: {
			value: "inline",
		},
	}) as AdditionalStyle;

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
		createTemporalActiveContext({
			regionIDRef: attributes["region"],
			additionalStyles: [inlineStyle],
		}),
	);

	const cues: CueNode[] = [];

	for (let i = 0; i < node.children.length; i++) {
		const children = node.children[i];

		if (children.content.content === "span") {
			cues.push(...getCuesFromSpan(children, localScope, attributes["xml:id"] || `unk-par-${i}`));
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

			cues.push(
				createCueFromAnonymousSpan(
					children,
					node.content.attributes["xml:id"] || `unk-span-${i}`,
					localScope,
				),
			);

			continue;
		}
	}

	return cues;
}

function getCuesFromSpan(
	node: NodeWithRelationship<Token>,
	scope: Scope,
	parentId: string,
): CueNode[] {
	if (!node.children.length) {
		return [];
	}

	const cues: CueNode[] = [];
	const { attributes } = node.content;
	const styleParser = createStyleParser(scope);

	styleParser.process(
		Object.create(attributes, {
			"xml:id": {
				value: "inline",
				enumerable: true,
			},
		}),
	);

	const inlineStyle = Object.create(styleParser.get("inline"), {
		kind: {
			value: "inline",
		},
	}) as AdditionalStyle;

	const localScope = createScope(
		scope,
		createTimeContext({
			begin: attributes["begin"],
			dur: attributes["dur"],
			end: attributes["end"],
			timeContainer: attributes["timeContainer"],
		}),
		createTemporalActiveContext({
			regionIDRef: attributes["region"],
			additionalStyles: [inlineStyle],
		}),
	);

	const nextCueID = attributes["xml:id"] || parentId;

	if (isTimestamp(attributes)) {
		const timeContext = readScopeTimeContext(localScope);

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
			cues.push(...getCuesFromSpan(children, localScope, parentId));
			continue;
		}

		if (children.content.content === "br") {
			processLineBreak(cues[cues.length - 1]);
			continue;
		}

		if (children.content.type === TokenType.STRING) {
			if (!cues.length) {
				cues.push(
					createCueFromAnonymousSpan(
						children,
						node.content.attributes["xml:id"] || `unk-span-${i}`,
						localScope,
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
	node: NodeWithRelationship<Token>,
	parentId: string,
	scope: Scope,
): CueNode {
	const {
		content: { content, attributes },
	} = node;

	/**
	 * A new scope is requires here otherwise anonymous
	 * span are not able to inherit the `timeContainer`
	 */

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

	return new CueNode({
		id: parentId,
		content,
		startTime: timeContext.startTime,
		endTime: timeContext.endTime,

		/** @TODO Fix region association */
		region: undefined,
		// entities: styles.map((style) => Entities.createStyleEntity(style.attributes)),
	});
}

function isTimestamp(attributes: Record<string, string>): boolean {
	return (
		typeof attributes["begin"] !== "undefined" &&
		typeof attributes["end"] === "undefined" &&
		typeof attributes["dur"] === "undefined"
	);
}
