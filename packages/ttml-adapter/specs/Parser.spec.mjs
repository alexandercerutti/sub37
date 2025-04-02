// @ts-check

import { describe, expect, it } from "@jest/globals";
import { parseCue } from "../lib/Parser/parseCue.js";
import { createScope } from "../lib/Parser/Scope/Scope.js";
import { createTimeContext } from "../lib/Parser/Scope/TimeContext.js";
import { TokenType } from "../lib/Parser/Token.js";
import { createDocumentContext } from "../lib/Parser/Scope/DocumentContext.js";
import { NodeTree } from "../lib/Parser/Tags/NodeTree.js";
import { nodeScopeSymbol } from "../lib/Adapter.js";

/**
 * @param {import("../lib/Parser/Tags/NodeTree.js").NodeWithRelationship<import("./NodeTree.spec.mjs").Token & import("../lib/Adapter.js").NodeWithScope>} node
 */

function linkChildrenAndParents(node) {
	for (const child of node.children) {
		child.parent = node;
		child.content[nodeScopeSymbol] = createScope(
			node.content[nodeScopeSymbol],
			createTimeContext({
				begin: child.content.attributes["begin"],
				end: child.content.attributes["end"],
				dur: child.content.attributes["dur"],
				timeContainer: undefined,
			}),
		);
		linkChildrenAndParents(child);
	}
}

describe("parseCue", () => {
	it("should be coherent with anonymous span", () => {
		const baseScope = createScope(
			undefined,
			createDocumentContext(new NodeTree(), { "xml:lang": "" }),
		);

		const paragraphAttrs = {
			timeContainer: "seq",
			"xml:id": "par-01",
		};

		const paragraphScope = createScope(
			baseScope,
			/**
			 * Paragraph timeContainer is set outside parseCue
			 */
			createTimeContext(paragraphAttrs),
		);

		const Paragraph = {
			content: {
				[nodeScopeSymbol]: paragraphScope,
				content: "p",
				attributes: paragraphAttrs,
				type: TokenType.START_TAG,
			},
			children: [
				{
					content: {
						content: "Hello",
						attributes: {},
						type: TokenType.STRING,
					},
					children: [],
				},
				{
					content: {
						content: "span",
						attributes: {},
						type: TokenType.START_TAG,
					},
					children: [
						{
							content: {
								content: "Guten ",
								attributes: {},
								type: TokenType.STRING,
							},
							children: [],
						},
						{
							content: {
								content: "span",
								attributes: {},
								type: TokenType.START_TAG,
							},
							children: [
								{
									content: {
										content: "Tag",
										attributes: {},
										type: TokenType.STRING,
									},
									children: [],
								},
							],
						},
					],
				},
				{
					content: {
						content: "Allo",
						attributes: {},
						type: TokenType.STRING,
					},
					children: [],
				},
			],
		};

		linkChildrenAndParents(Paragraph);

		/**
		 * <p timeContainer="seq" xml:id="par-01">
		 * 	Hello <!-- This will be hidden: implicit duration of element in a sequential parent is 0 -->
		 * 	<span> <!-- parallel container (default) -->
		 * 		Guten <!-- This will be shown: implicit duration of element in a parallel parent is indefinite -->
		 * 		<span> <!-- parallel container (default) -->
		 * 			Tag <!-- This will be shown: implicit duration of element in a parallel parent is indefinite -->
		 * 		</span>
		 * 	</span>
		 * 	Allo <!-- This will be hidden: implicit duration of element in a sequential parent is 0 -->
		 * </p>
		 */

		const parsed = parseCue(Paragraph);

		expect(parsed).toBeInstanceOf(Array);
		expect(parsed.length).toBe(4);
		expect(parsed[0]).toMatchObject({
			content: "Hello",
			startTime: 0,
			endTime: 0,
		});
		expect(parsed[1]).toMatchObject({
			content: "Guten ",
			startTime: 0,
			endTime: Infinity,
		});
		expect(parsed[2]).toMatchObject({
			content: "Tag",
			startTime: 0,
			endTime: Infinity,
		});
		expect(parsed[3]).toMatchObject({
			content: "Allo",
			startTime: 0,
			endTime: 0,
		});
	});

	it("should be return timestamps", () => {
		const baseScope = createScope(
			undefined,
			createDocumentContext(new NodeTree(), { "xml:lang": "" }),
			createTimeContext({}),
		);

		const paragraphAttrs = {
			"xml:id": "par-01",
			begin: "0s",
			end: "25s",
		};

		const paragraphScope = createScope(
			baseScope,
			/**
			 * Paragraph timeContainer is set outside parseCue
			 */
			createTimeContext(paragraphAttrs),
		);

		const Paragraph1 = {
			content: {
				[nodeScopeSymbol]: paragraphScope,
				content: "p",
				attributes: paragraphAttrs,
				type: TokenType.START_TAG,
			},
			children: [
				{
					content: {
						type: TokenType.START_TAG,
						content: "span",
						attributes: {
							begin: "0s",
						},
					},
					children: [
						{
							content: {
								type: TokenType.STRING,
								content: "Lorem",
								attributes: {},
							},
							children: [],
						},
					],
				},
				{
					content: {
						type: TokenType.START_TAG,
						content: "span",
						attributes: {
							begin: "1s",
						},
					},
					children: [
						{
							content: {
								type: TokenType.STRING,
								content: "ipsum",
								attributes: {},
							},
							children: [],
						},
					],
				},
				{
					content: {
						type: TokenType.START_TAG,
						content: "span",
						attributes: {
							begin: "2s",
						},
					},
					children: [
						{
							content: {
								type: TokenType.STRING,
								content: "dolor",
								attributes: {},
							},
							children: [],
						},
					],
				},
				{
					content: {
						type: TokenType.START_TAG,
						content: "span",
						attributes: {
							begin: "3s",
						},
					},
					children: [
						{
							content: {
								type: TokenType.STRING,
								content: "sit",
								attributes: {},
							},
							children: [],
						},
					],
				},
			],
		};

		linkChildrenAndParents(Paragraph1);

		const parsed = parseCue(Paragraph1);

		expect(parsed).toBeInstanceOf(Array);
		expect(parsed.length).toBe(4);
		expect(parsed[0]).toMatchObject({
			content: "Lorem",
			startTime: 0,
			endTime: 25000,
		});
		expect(parsed[1]).toMatchObject({
			content: "ipsum",
			startTime: 1000,
			endTime: 25000,
		});
		expect(parsed[2]).toMatchObject({
			content: "dolor",
			startTime: 2000,
			endTime: 25000,
		});
		expect(parsed[3]).toMatchObject({
			content: "sit",
			startTime: 3000,
			endTime: 25000,
		});
	});
});

describe("Cell Resolution", () => {
	it.todo("should default if not available");

	it.todo("should default if its values are incorrect");

	it.todo("should be used it available and correct");

	it.todo("should be allowed to be converted to pixels");

	/**
	 * @TODO Add tests for font-size cell conversion to pixel
	 */

	/**
	 * @TODO Add tests for font-size percentage
	 */
});

describe("Lengths", () => {
	/**
	 * Add tests for <length> unit measure with the dedicated parser
	 */
});

describe("Styling", () => {
	describe("Chaining Referential Styling", () => {
		it.todo("should be applied if one IDREF is specified through style attribute");

		it.todo("should be applied if multiple IDREFs are specified through style attribute");

		it.todo("should throw if there's a loop in styling referencing chain");
	});
});
