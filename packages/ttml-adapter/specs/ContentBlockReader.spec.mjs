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

	it("should create an tags tree only if the single tag is a supported one", () => {
		const testDocument = `
		<?xml version="1.0" encoding="UTF-8" standalone="no"?>
		<tt>
			<head>
				<ttp:profile use="http://netflix.com/ttml/profile/dfxp-ls-sdh" />
			</head>
			<body style="bodyStyle">
			</body>
		</tt>`;

		/**
		 * @TODO add one when a supported self-closing tag will be supported
		 */
	});

	it("Partial Netflix Blindspot track", () => {
		const track = `
			<?xml version="1.0" encoding="UTF-8" standalone="no"?>
			<tt xmlns:tt="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"
				xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling"
				ttp:cellResolution="40 19" ttp:pixelAspectRatio="1 1" ttp:tickRate="10000000" ttp:timeBase="media"
				tts:extent="640px 480px" xmlns="http://www.w3.org/ns/ttml">
				<head>
					<ttp:profile use="http://netflix.com/ttml/profile/dfxp-ls-sdh" />
					<styling>
						<style tts:color="white" tts:fontFamily="monospaceSansSerif" tts:fontSize="100%"
							xml:id="bodyStyle" />
						<style tts:color="white" tts:fontFamily="monospaceSansSerif" tts:fontSize="100%"
							tts:fontStyle="italic" xml:id="style_0" />
					</styling>
					<layout>
						<region xml:id="region_00">
							<style tts:textAlign="left" />
							<style tts:displayAlign="center" />
						</region>
						<region xml:id="region_01">
							<style tts:textAlign="left" />
							<style tts:displayAlign="center" />
						</region>
						<region xml:id="region_02">
							<style tts:textAlign="left" />
							<style tts:displayAlign="center" />
						</region>
					</layout>
				</head>
				<body style="bodyStyle">
					<div xml:space="preserve">
					<p begin="10010000t" end="49642508t" region="region_00" xml:id="subtitle0">♪♪</p>
					<p begin="342010001t" end="365370003t" region="region_00" xml:id="subtitle1">(alarm beeping,</p>
					<p begin="342010001t" end="365370003t" region="region_01" xml:id="subtitle2">Jane gasps)</p>
					<p begin="430429999t" end="460459999t" region="region_00" xml:id="subtitle3">(Sarah)</p>
					<p begin="430429999t" end="460459999t" region="region_01" xml:id="subtitle4">Okay, got your stuff.</p>
					<p begin="460877500t" end="495917505t" region="region_00" xml:id="subtitle5">Clothes, toothbrush.</p>
					<p begin="496335005t" end="509267508t" region="region_00" xml:id="subtitle6">You slept here?</p>
					<p begin="509685008t" end="528870007t" region="region_00" xml:id="subtitle7">Yeah.</p>
					<p begin="546802506t" end="563065001t" region="region_00" xml:id="subtitle8">Okay, look.</p>
					<p begin="563482502t" end="579755008t" region="region_00" xml:id="subtitle9">I know I shouldn't</p>
					<p begin="563482502t" end="579755008t" region="region_01" xml:id="subtitle10">have brought Dad</p>
					<p begin="580172508t" end="595182503t" region="region_00" xml:id="subtitle11">into your home</p>
					<p begin="580172508t" end="595182503t" region="region_01" xml:id="subtitle12">without asking.</p>
					<p begin="595600003t" end="625212503t" region="region_00" xml:id="subtitle13">But I know if I asked,</p>
					<p begin="595600003t" end="625212503t" region="region_01" xml:id="subtitle14">you would've said no.</p>
					<p begin="625630003t" end="640640000t" region="region_00" xml:id="subtitle15">Which is why you</p>
					<p begin="625630003t" end="640640000t" region="region_01" xml:id="subtitle16">shouldn't have done it.</p>
					<p begin="641057500t" end="670262508t" region="region_00" xml:id="subtitle17">You could have at least,</p>
					<p begin="641057500t" end="670262508t" region="region_01" xml:id="subtitle18">you know, shaken his hand</p>
					<p begin="670670000t" end="683185001t" region="region_00" xml:id="subtitle19">or said hi.</p>
					<p begin="683602502t" end="700292508t" region="region_00" xml:id="subtitle20">I won't talk</p>
					<p begin="683602502t" end="700292508t" region="region_01" xml:id="subtitle21">about this here.</p>
					<p begin="700700000t" end="717807506t" region="region_00" xml:id="subtitle22">Well, when do you wanna</p>
					<p begin="700700000t" end="717807506t" region="region_01" xml:id="subtitle23">talk about it, Kurt?</p>
					<p begin="718225006t" end="746585005t" region="region_00" xml:id="subtitle24">Taylor is alive,</p>
					<p begin="718225006t" end="746585005t" region="region_01" xml:id="subtitle25">Dad is innocent.</p>
					<p begin="747002506t" end="770770000t" region="region_00" xml:id="subtitle26">Her being back does</p>
					<p begin="747002506t" end="770770000t" region="region_01" xml:id="subtitle27">not change the fact</p>
					<p begin="771187500t" end="785372503t" region="region_00" xml:id="subtitle28">that someone</p>
					<p begin="771187500t" end="785372503t" region="region_01" xml:id="subtitle29">kidnapped her.</p>
						<p begin="785790003t" end="803722502t" region="region_00" xml:id="subtitle30">So, then talk me</p>
					</div>
				</body>
			</tt>
`;

		const headToken = {
			content: "head",
		};

		const divToken = {
			content: "div",
			attributes: {
				"xml:space": "preserve",
			},
		};

		const tokenizer = new Tokenizer(track);
		const blockParser = getNextContentBlock(tokenizer);

		// Skipping <tt>
		blockParser.next();

		expect(blockParser.next().value).toMatchObject([
			BlockType.STYLE,
			{
				parent: {
					content: headToken,
				},
				content: {
					content: "styling",
				},
				children: [
					{
						parent: {
							content: {
								content: "styling",
							},
						},
						content: {
							content: "style",
							attributes: {
								"tts:color": "white",
								"tts:fontFamily": "monospaceSansSerif",
								"tts:fontSize": "100%",
								"xml:id": "bodyStyle",
							},
						},
						children: [],
					},
					{
						parent: {
							content: {
								content: "styling",
							},
						},
						content: {
							content: "style",
							attributes: {
								"tts:color": "white",
								"tts:fontFamily": "monospaceSansSerif",
								"tts:fontSize": "100%",
								"tts:fontStyle": "italic",
								"xml:id": "style_0",
							},
						},
						children: [],
					},
				],
			},
		]);

		expect(blockParser.next().value).toMatchObject([
			BlockType.REGION,
			{
				parent: {
					content: headToken,
				},
				content: {
					content: "layout",
				},
				children: [
					{
						content: {
							content: "region",
							attributes: {
								"xml:id": "region_00",
							},
						},
						children: [
							{
								content: {
									content: "style",
									attributes: {
										"tts:textAlign": "left",
									},
								},
							},
							{
								content: {
									content: "style",
									attributes: {
										"tts:displayAlign": "center",
									},
								},
							},
						],
					},
					{
						content: {
							content: "region",
							attributes: {
								"xml:id": "region_01",
							},
						},
						children: [
							{
								content: {
									content: "style",
									attributes: {
										"tts:textAlign": "left",
									},
								},
							},
							{
								content: {
									content: "style",
									attributes: {
										"tts:displayAlign": "center",
									},
								},
							},
						],
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
										"tts:textAlign": "left",
									},
								},
							},
							{
								content: {
									content: "style",
									attributes: {
										"tts:displayAlign": "center",
									},
								},
							},
						],
					},
				],
			},
		]);

		expect(blockParser.next().value).toMatchObject([
			BlockType.GROUP,
			{
				content: {
					content: "body",
					attributes: {
						style: "bodyStyle",
					},
				},
				children: [],
			},
		]);

		expect(blockParser.next().value).toMatchObject([
			BlockType.GROUP,
			{
				content: {
					...divToken,
				},
				children: [],
			},
		]);

		for (let i = 0; i < 31; i++) {
			expect(blockParser.next().value).toMatchObject([
				BlockType.CUE,
				{
					parent: {
						content: divToken,
					},
					content: {
						content: "p",
					},
					children: [],
				},
			]);
		}

		expect(blockParser.next()).toMatchObject({
			done: true,
			value: null,
		});
	});
});
