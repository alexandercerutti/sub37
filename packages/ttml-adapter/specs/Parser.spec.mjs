// @ts-check

import { describe, expect, it } from "@jest/globals";
import TTMLAdapter from "../lib/Adapter.js";

function parse(xml) {
	return new TTMLAdapter().parse(xml).data;
}

describe("parseCue", () => {
	it("should be coherent with anonymous span", () => {
		/*
		 * <p timeContainer="seq" xml:id="par-01">
		 *   Hello           ← zero duration in a sequential parent → not emitted
		 *   <span>          ← parallel container (default)
		 *     Guten         ← infinite duration in a parallel parent → emitted
		 *     <span>        ← parallel container (default)
		 *       Tag         ← infinite duration in a parallel parent → emitted
		 *     </span>
		 *   </span>
		 *   Allo            ← zero duration in a sequential parent → not emitted
		 * </p>
		 */
		const cues = parse(`
			<tt xml:lang="" ttp:timeBase="media">
				<body>
					<div>
						<p timeContainer="seq" xml:id="par-01">
							Hello
							<span>
								Guten
								<span>
									Tag
								</span>
							</span>
							Allo
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues).toBeInstanceOf(Array);
		expect(cues.length).toBe(2);
		/* Tokenizer trims text nodes, so boundary whitespace is lost */
		expect(cues[0]).toMatchObject({ content: "Guten", startTime: 0, endTime: Infinity });
		expect(cues[1]).toMatchObject({ content: "Tag", startTime: 0, endTime: Infinity });
	});

	it("should return timestamps", () => {
		const cues = parse(`
			<tt xml:lang="" ttp:timeBase="media">
				<body>
					<div>
						<p xml:id="par-01" begin="0s" end="25s">
							<span begin="0s">Lorem</span>
							<span begin="1s">ipsum</span>
							<span begin="2s">dolor</span>
							<span begin="3s">sit</span>
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues).toBeInstanceOf(Array);
		expect(cues.length).toBe(4);
		expect(cues[0]).toMatchObject({ content: "Lorem", startTime: 0, endTime: 25000 });
		expect(cues[1]).toMatchObject({ content: "ipsum", startTime: 1000, endTime: 25000 });
		expect(cues[2]).toMatchObject({ content: "dolor", startTime: 2000, endTime: 25000 });
		expect(cues[3]).toMatchObject({ content: "sit", startTime: 3000, endTime: 25000 });
	});

	it("should merge adjacent sibling strings under the same parent into one cue", () => {
		/*
		 * <p begin="0s" end="5s">Hello World</p>
		 * Single text run → one cue
		 */
		const cues = parse(`
			<tt xml:lang="" ttp:timeBase="media">
				<body>
					<div>
						<p xml:id="par-01" begin="0s" end="5s">
							Hello World
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBe(1);
		expect(cues[0]).toMatchObject({ content: "Hello World" });
	});

	it("should not merge a string sibling with a cue produced inside a span", () => {
		/*
		 * <p begin="0s" end="5s">Hello <span>Middle</span> World</p>
		 * Three separate text tokens → three separate cues
		 */
		const cues = parse(`
			<tt xml:lang="" ttp:timeBase="media">
				<body>
					<div>
						<p xml:id="par-01" begin="0s" end="5s">
							Hello <span>Middle</span> World
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBe(3);
		/* Tokenizer trims text nodes: leading/trailing whitespace at tag boundaries is lost */
		expect(cues[0]).toMatchObject({ content: "Hello" });
		expect(cues[1]).toMatchObject({ content: "Middle" });
		expect(cues[2]).toMatchObject({ content: "World" });
	});

	it("should attach a region to cues that reference it", () => {
		const cues = parse(`
			<tt xml:lang="" ttp:timeBase="media">
				<head>
					<layout>
						<region xml:id="r1" />
					</layout>
				</head>
				<body>
					<div>
						<p xml:id="par-01" begin="0s" end="5s">
							<span region="r1">Hello</span>
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBe(1);
		expect(cues[0].region?.id).toBe("r1");
	});

	it("should attach animation entities to cues that reference an animation", () => {
		const cues = parse(`
			<tt xml:lang="" ttp:timeBase="media" xmlns:tts="http://www.w3.org/ns/ttml#styling">
				<head>
					<layout>
						<region xml:id="r1" />
					</layout>
				</head>
				<body>
					<div>
						<p xml:id="par-01" region="r1" begin="0s" end="5s">
							<animate xml:id="a1" begin="0s" dur="5s" calcMode="discrete" keyTimes="0;1" tts:color="red;blue"/>Hello
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBe(1);
		const animEntity = cues[0].entities.find((e) => e.kind === "discrete");
		expect(animEntity).toBeDefined();
		expect(animEntity.id).toBe("in:animation-a1");
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
