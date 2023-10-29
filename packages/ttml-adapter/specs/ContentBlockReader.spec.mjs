import { describe, expect, it } from "@jest/globals";
import { BlockType, getNextContentBlock } from "../lib/Parser/ContentBlockReader.js";
import { Tokenizer } from "../lib/Parser/Tokenizer.js";

describe("ContentBlockReader", () => {
	it("should return a paragraph or a region", () => {
		const testDocument1 = `
			<tt xml:lang="en">
				<head>
					<layout>
						<region xml:id="r1" tts:color="white" tts:origin="10c 4c" tts:extent="40c 5c"/>
					</layout>
				</head>
				<body>
					<div begin="0s" end="25s">
						<p>
							<span begin="0s">Lorem</span>
							<span begin="1s">ipsum</span>
							<span begin="2s">dolor</span>
							<span begin="3s">sit</span>
						</p>
						<p>
							<span begin="4s">Amet</span>
							<span begin="5s">consectetur</span>
							<span begin="6s">adipiscing</span>
							<span begin="7s">elit</span>
						</p>
						<p>
							<span begin="8s">Sed</span>
							<span begin="9s">do</span>
							<span begin="10s">eiusmod</span>
							<span begin="11s">tempor</span>
							<span begin="12s">incididunt </span>
							<span begin="13s">labore</span>
						</p>
						<p>
							<span begin="14s">et</span>
							<span begin="15s">dolore</span>
							<span begin="16s">magna</span>
							<span begin="17s">aliqua</span>
						</p>
						<p>
							<span begin="18s">Ut</span>
							<span begin="19s">enim</span>
							<span begin="20s">ad</span>
							<span begin="21s">minim</span>
							<span begin="22s">veniam</span>
							<span begin="23s">quis,</span>
							<span begin="24s">nostrud</span>
						</p>
					</div>
				</body>
			</tt>
		`;

		const expectedParagraphObjectContent = {
			content: {
				content: "p",
			},
		};

		const expectedSpanObjectContent = {
			content: {
				content: "span",
			},
		};

		const expectedRootChildrenNode = {
			...expectedSpanObjectContent,
			children: [],
			parent: expectedParagraphObjectContent,
		};

		const tokenizerInstance = new Tokenizer(testDocument1);
		const generator = getNextContentBlock(tokenizerInstance);

		// Ignoring <tt>
		generator.next();

		expect(generator.next().value).toMatchObject([
			BlockType.REGION,
			{
				content: {
					content: "layout",
				},
				children: [
					{
						content: {
							content: "region",
							attributes: {
								"xml:id": "r1",
								"tts:color": "white",
								"tts:origin": "10c 4c",
								"tts:extent": "40c 5c",
							},
						},
					},
				],
			},
		]);

		expect(generator.next().value).toMatchObject([
			BlockType.GROUP,
			{
				content: {
					content: "div",
					attributes: {
						begin: "0s",
						end: "25s",
					},
				},
				children: [],
			},
		]);

		expect(generator.next().value).toMatchObject([
			BlockType.CUE,
			{
				...expectedParagraphObjectContent,
				children: [
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
				],
			},
		]);

		expect(generator.next().value).toMatchObject([
			BlockType.CUE,
			{
				...expectedParagraphObjectContent,
				children: [
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
				],
			},
		]);

		expect(generator.next().value).toMatchObject([
			BlockType.CUE,
			{
				...expectedParagraphObjectContent,
				children: [
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
				],
			},
		]);

		expect(generator.next().value).toMatchObject([
			BlockType.CUE,
			{
				parent: {
					content: {
						content: "div",
					},
				},
				...expectedParagraphObjectContent,
				children: [
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
				],
			},
		]);

		expect(generator.next().value).toMatchObject([
			BlockType.CUE,
			{
				parent: {
					content: {
						content: "div",
					},
				},
				...expectedParagraphObjectContent,
				children: [
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
					expectedRootChildrenNode,
				],
			},
		]);

		const lastRound = generator.next();

		expect(lastRound).toMatchObject({ done: true, value: null });
	});

	it("should ignore nodes in the wrong place, with a wrong parent relationship", () => {
		const testDocument1 = `
			<tt xml:lang="en">
				<head>
					<style />
					<styling>
						<style xml:id="test" />
					</styling>
				</head>
				<body>
					<style></style>
				</body>
			</tt>
		`;

		const tokenizerInstance = new Tokenizer(testDocument1);
		const generator = getNextContentBlock(tokenizerInstance);

		expect(generator.next().value).toMatchObject([
			BlockType.DOCUMENT,
			{
				content: {
					content: "tt",
					attributes: {
						"xml:lang": "en",
					},
				},
				children: [],
			},
		]);

		expect(generator.next().value).toMatchObject([
			BlockType.STYLE,
			{
				parent: {
					content: {
						content: "head",
					},
				},
				content: {
					content: "styling",
				},
				children: [
					{
						content: {
							content: "style",
						},
						children: [],
						parent: {
							content: {
								content: "styling",
							},
						},
					},
				],
			},
		]);
	});

	it("should return a region and a styling, if available", () => {
		const testDocument = `
			<tt xml:lang="en">
				<head>
					<layout>
						<region xml:id="region_00" />
						<region xml:id="region_01"/>
						<region xml:id="region_02">
							<style xml:id="nested_style_1" />
							<style xml:id="nested_style_2" />
							<style xml:id="nested_style_3" />
						</region>
					</layout>
					<styling>
						<style xml:id="inheritable_style_1" />
						<style xml:id="inheritable_style_2" />
						<style xml:id="inheritable_style_3" />
					</styling>
				</head>
				<body></body>
			</tt>
		`;

		const tokenizerInstance = new Tokenizer(testDocument);
		const generator = getNextContentBlock(tokenizerInstance);

		// Ignoring <tt>
		void generator.next();

		expect(generator.next().value).toMatchObject([
			BlockType.REGION,
			{
				parent: {
					content: {
						content: "head",
					},
				},
				content: {
					content: "layout",
					attributes: {},
				},
				children: [
					{
						content: {
							content: "region",
							attributes: {
								"xml:id": "region_00",
							},
						},
						children: [],
					},
					{
						content: {
							content: "region",
							attributes: {
								"xml:id": "region_01",
							},
						},
						children: [],
					},
					{
						content: {
							content: "region",
							attributes: {
								"xml:id": "region_02",
							},
						},
						children: [
							{
								content: {
									content: "style",
									attributes: {
										"xml:id": "nested_style_1",
									},
								},
								children: [],
							},
							{
								content: {
									content: "style",
									attributes: {
										"xml:id": "nested_style_2",
									},
								},
								children: [],
							},
							{
								content: {
									content: "style",
									attributes: {
										"xml:id": "nested_style_3",
									},
								},
								children: [],
							},
						],
					},
				],
			},
		]);

		expect(generator.next().value).toMatchObject([
			BlockType.STYLE,
			{
				parent: {
					content: {
						content: "head",
					},
				},
				content: {
					content: "styling",
					attributes: {},
				},
				children: [
					{
						content: {
							content: "style",
							attributes: {
								"xml:id": "inheritable_style_1",
							},
						},
						children: [],
					},
					{
						content: {
							content: "style",
							attributes: {
								"xml:id": "inheritable_style_2",
							},
						},
						children: [],
					},
					{
						content: {
							content: "style",
							attributes: {
								"xml:id": "inheritable_style_3",
							},
						},
						children: [],
					},
				],
			},
		]);
	});
});
