// @ts-check

import { describe, expect, it } from "@jest/globals";
import { parseCue } from "../lib/Parser/parseCue.js";
import { createScope } from "../lib/Parser/Scope/Scope.js";
import { createTimeContext } from "../lib/Parser/Scope/TimeContext.js";
import { TokenType } from "../lib/Parser/Token.js";
import { createDocumentContext } from "../lib/Parser/Scope/DocumentContext.js";

describe("parseCue", () => {
	it("should be coherent with anonymous span", () => {
		const Hello = {
			content: {
				content: "Hello",
				attributes: {},
				type: TokenType.STRING,
			},
			children: [],
		};

		const Guten = {
			content: {
				content: "Guten ",
				attributes: {},
				type: TokenType.STRING,
			},
			children: [],
		};

		const Tag = {
			content: {
				content: "Tag",
				attributes: {},
				type: TokenType.STRING,
			},
			children: [],
		};

		const NamedSpan1 = {
			content: {
				content: "span",
				attributes: {},
				type: TokenType.START_TAG,
			},
			children: [
				Guten,
				{
					content: {
						content: "span",
						attributes: {},
						type: TokenType.START_TAG,
					},
					children: [Tag],
				},
			],
		};

		const Allo = {
			content: {
				content: "Allo",
				attributes: {},
				type: TokenType.STRING,
			},
			children: [],
		};

		const Paragraph = {
			content: {
				content: "p",
				attributes: {
					timeContainer: "seq",
					"xml:id": "par-01",
				},
				type: TokenType.START_TAG,
			},
			children: [Hello, NamedSpan1, Allo],
		};

		Hello.parent = Paragraph;
		Allo.parent = Paragraph;
		NamedSpan1.parent = Paragraph;
		Guten.parent = NamedSpan1;
		Tag.parent = NamedSpan1.children[0];

		const scope = createScope(undefined, createDocumentContext({}));
		const parsed = parseCue(Paragraph, scope);

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
		const Paragraph1 = {
			content: {
				content: "p",
				attributes: {
					"xml:id": "par-01",
				},
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

		const scope = createScope(
			undefined,
			createDocumentContext({}),
			createTimeContext({
				begin: "0s",
				end: "25s",
			}),
		);
		const parsed = parseCue(Paragraph1, scope);

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

describe("Regions parsing", () => {
	it("should ignore a region if it's IDREF is not unique in the scope of document instance", () => {
		/**
		 * @TODO
		 */
	});

	/**
	 * Add tests for createRegionParser: tts attributes should
	 * belong to styles property
	 */

	it("should use only one inline region", () => {
		/**
		 * @TODO
		 */
	});

	it("should use only attribute one if both attribute and inline region are available", () => {
		/**
		 * @TODO
		 */
	});

	it("should ignore children with a different region attribute from the parent", () => {
		/**
		 * @TODO
		 */
	});

	it("should ignore children with an inline region while parent has region attribute", () => {
		/**
		 * @TODO
		 */
	});
});

describe("Cell Resolution", () => {
	it("should default if not available", () => {
		/**
		 * @TODO
		 */
	});

	it("should default if its values are incorrect", () => {
		/**
		 * @TODO
		 */
	});

	it("should be used it available and correct", () => {
		/**
		 * @TODO
		 */
	});

	it("should be allowed to be converted to pixels", () => {
		/**
		 * @TODO
		 */
	});

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
		it("should be applied if one IDREF is specified through style attribute", () => {
			/**
			 * @TODO
			 */
		});

		it("should be applied if multiple IDREFs are specified through style attribute", () => {
			/**
			 * @TODO
			 */
		});

		it("should throw if there's a loop in styling referencing chain", () => {
			/**
			 * @TODO
			 */
		});
	});
});
