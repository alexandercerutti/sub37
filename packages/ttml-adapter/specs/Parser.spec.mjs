// @ts-check

import { describe, expect, it } from "@jest/globals";
import { parseCue } from "../lib/Parser/parseCue.js";
import { createScope } from "../lib/Parser/Scope/Scope.js";
import { createTimeContext } from "../lib/Parser/Scope/TimeContext.js";
import { TokenType } from "../lib/Parser/Token.js";
import { createDocumentContext } from "../lib/Parser/Scope/DocumentContext.js";
import { NodeTree } from "../lib/Parser/Tags/NodeTree.js";
import { nodeScopeSymbol } from "../lib/Adapter.js";
import { createRegionContainerContext } from "../lib/Parser/Scope/RegionContainerContext.js";
import { createTemporalActiveContext } from "../lib/Parser/Scope/TemporalActiveContext.js";
import { createAnimationContainerContext } from "../lib/Parser/Scope/AnimationContainerContext.js";

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
		 * 	Hello <!-- zero duration in a sequential parent → not emitted -->
		 * 	<span> <!-- parallel container (default) -->
		 * 		Guten <!-- infinite duration in a parallel parent → emitted -->
		 * 		<span> <!-- parallel container (default) -->
		 * 			Tag <!-- infinite duration in a parallel parent → emitted -->
		 * 		</span>
		 * 	</span>
		 * 	Allo <!-- zero duration in a sequential parent → not emitted -->
		 * </p>
		 */

		const parsed = parseCue(Paragraph);

		expect(parsed).toBeInstanceOf(Array);
		expect(parsed.length).toBe(2);
		expect(parsed[0]).toMatchObject({
			content: "Guten ",
			startTime: 0,
			endTime: Infinity,
		});
		expect(parsed[1]).toMatchObject({
			content: "Tag",
			startTime: 0,
			endTime: Infinity,
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

	it("should merge adjacent sibling strings under the same parent into one cue", () => {
		const baseScope = createScope(
			undefined,
			createDocumentContext(new NodeTree(), { "xml:lang": "" }),
		);

		const paragraphAttrs = { "xml:id": "par-01", begin: "0s", end: "5s" };
		const paragraphScope = createScope(baseScope, createTimeContext(paragraphAttrs));

		const Paragraph = {
			content: {
				[nodeScopeSymbol]: paragraphScope,
				content: "p",
				attributes: paragraphAttrs,
				type: TokenType.START_TAG,
			},
			children: [
				{
					content: { type: TokenType.STRING, content: "Hello ", attributes: {} },
					children: [],
				},
				{
					content: { type: TokenType.STRING, content: "World", attributes: {} },
					children: [],
				},
			],
		};

		linkChildrenAndParents(Paragraph);

		/**
		 * <p begin="0s" end="5s" xml:id="par-01">
		 *   Hello World  <!-- two STRING tokens, same scope parent → merged into one cue -->
		 * </p>
		 */
		const parsed = parseCue(Paragraph);

		expect(parsed.length).toBe(1);
		expect(parsed[0]).toMatchObject({ content: "Hello World" });
	});

	it("should not merge a string sibling with a cue produced inside a span", () => {
		const baseScope = createScope(
			undefined,
			createDocumentContext(new NodeTree(), { "xml:lang": "" }),
		);

		const paragraphAttrs = { "xml:id": "par-01", begin: "0s", end: "5s" };
		const paragraphScope = createScope(baseScope, createTimeContext(paragraphAttrs));

		const Paragraph = {
			content: {
				[nodeScopeSymbol]: paragraphScope,
				content: "p",
				attributes: paragraphAttrs,
				type: TokenType.START_TAG,
			},
			children: [
				{
					content: { type: TokenType.STRING, content: "Hello ", attributes: {} },
					children: [],
				},
				{
					content: { type: TokenType.START_TAG, content: "span", attributes: {} },
					children: [
						{
							content: { type: TokenType.STRING, content: "Middle", attributes: {} },
							children: [],
						},
					],
				},
				{
					content: { type: TokenType.STRING, content: " World", attributes: {} },
					children: [],
				},
			],
		};

		linkChildrenAndParents(Paragraph);

		/**
		 * <p begin="0s" end="5s" xml:id="par-01">
		 *   Hello            <!-- own cue -->
		 *   <span>Middle</span>  <!-- own cue -->
		 *   World            <!-- own cue: must NOT merge with Middle despite same scope.parent as Hello -->
		 * </p>
		 */
		const parsed = parseCue(Paragraph);

		expect(parsed.length).toBe(3);
		expect(parsed[0]).toMatchObject({ content: "Hello " });
		expect(parsed[1]).toMatchObject({ content: "Middle" });
		expect(parsed[2]).toMatchObject({ content: " World" });
	});

	it("should attach a region to cues that reference it", () => {
		const baseScope = createScope(
			undefined,
			createDocumentContext(new NodeTree(), { "xml:lang": "" }),
			createRegionContainerContext([
				{ attributes: { "xml:id": "r1", begin: "0s", end: "5s" }, children: [] },
			]),
		);

		const paragraphAttrs = { "xml:id": "par-01", begin: "0s", end: "5s" };
		const paragraphScope = createScope(baseScope, createTimeContext(paragraphAttrs));

		const stringScope = createScope(
			paragraphScope,
			createTimeContext({
				begin: undefined,
				end: undefined,
				dur: undefined,
				timeContainer: undefined,
			}),
			createTemporalActiveContext({ regionIDRef: "r1" }),
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
						[nodeScopeSymbol]: stringScope,
						type: TokenType.STRING,
						content: "Hello",
						attributes: {},
					},
					children: [],
				},
			],
		};

		Paragraph.children[0].parent = Paragraph;

		/**
		 * <p begin="0s" end="5s" xml:id="par-01">
		 *   Hello  <!-- anonymous span, TAC references region r1 -->
		 * </p>
		 */
		const parsed = parseCue(Paragraph);

		expect(parsed.length).toBe(1);
		expect(parsed[0].region?.id).toBe("r1");
	});

	it("should attach animation entities to cues that reference an animation", () => {
		const baseScope = createScope(
			undefined,
			createDocumentContext(new NodeTree(), { "xml:lang": "" }),
			createAnimationContainerContext([
				{
					calcMode: "discrete",
					attributes: {
						"xml:id": "a1",
						begin: "0s",
						dur: "5s",
						keyTimes: "0;1",
						"tts:color": "red;blue",
					},
				},
			]),
		);

		const paragraphAttrs = { "xml:id": "par-01", begin: "0s", end: "5s" };
		const paragraphScope = createScope(baseScope, createTimeContext(paragraphAttrs));

		const stringScope = createScope(
			paragraphScope,
			createTimeContext({
				begin: undefined,
				end: undefined,
				dur: undefined,
				timeContainer: undefined,
			}),
			createTemporalActiveContext({ animationsIDRefs: ["a1"] }),
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
						[nodeScopeSymbol]: stringScope,
						type: TokenType.STRING,
						content: "Hello",
						attributes: {},
					},
					children: [],
				},
			],
		};

		Paragraph.children[0].parent = Paragraph;

		/**
		 * <p begin="0s" end="5s" xml:id="par-01">
		 *   <animate xml:id="a1" begin="0s" dur="5s" keyTimes="0;1" tts:color="red;blue" />
		 *   Hello  <!-- anonymous span, TAC references animation a1 -->
		 * </p>
		 */
		const parsed = parseCue(Paragraph);

		expect(parsed.length).toBe(1);
		const animEntity = parsed[0].entities.find((e) => e.kind === "discrete");
		expect(animEntity).toBeDefined();
		expect(animEntity.id).toBe("a1");
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
