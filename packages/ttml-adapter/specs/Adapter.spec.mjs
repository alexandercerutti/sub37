import { describe, it, expect } from "@jest/globals";
import { Entities } from "@sub37/server";
import TTMLAdapter from "../lib/Adapter.js";
import { KeyTimesPacedNotAllowedError } from "../lib/Parser/Animations/keyTimes/KeyTimesNotAllowedError.js";
import { KeySplinesNotAllowedError } from "../lib/Parser/Animations/keySplines/KeySplinesNotAllowedError.js";
import { KeySplinesRequiredError } from "../lib/Parser/Animations/keySplines/KeySplinesRequiredError.js";
import { KeySplinesAmountNotMatchingKeyTimesError } from "../lib/Parser/Animations/keySplines/KeySplinesAmountNotMatchingKeyTimesError.js";
import { KeySplinesInvalidControlsAmountError } from "../lib/Parser/Animations/keySplines/KeySplinesInvalidControlsAmountError.js";
import { KeySplinesCoordinateOutOfBoundaryError } from "../lib/Parser/Animations/keySplines/KeySplinesCoordinateOutOfBoundaryError.js";

// https://developer.mozilla.org/en-US/docs/Related/IMSC/Subtitle_placement

// #region Adapter
describe("General", () => {
	it("should report a critical error if the track does not start with a <tt> element", () => {
		const adapter = new TTMLAdapter();
		const result = adapter.parse(`
			<head>
				<layout></layout>
			</head>
			<body>
				<div>
					<p>Some Content that won't be used</p>
				</div>
			</body>
		`);

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors.some((e) => e.isCritical)).toBe(true);
	});
});
// #endregion

// #region Cues
describe("Cues", () => {
	describe("Timing semantics", () => {
		describe("Region temporal activation", () => {
			describe("Out-of-line regions", () => {
				it("should let cue inherit them from an out-of-line region", () => {
					const adapter = new TTMLAdapter();
					const { data: cues } = adapter.parse(`
							<tt xml:lang="en">
								<head>
									<layout>
										<region xml:id="r1" begin="3s" end="5s" />
										<region xml:id="r2" begin="3s" dur="5s" />
										<region xml:id="r3" begin="0s" dur="5s" />
									</layout>
								</head>
								<body>
									<div>
										<p region="r1">
											<!-- anonymous span -->
											Test cue r1
										</p>
										<p region="r2">
											<!-- anonymous span -->
											Test cue r2
										</p>
										<p region="r3">
											<!-- anonymous span -->
											Test cue r3
										</p>
									</div>
								</body>
							</tt>
							`);

					expect(cues.length).toBe(3);
					expect(cues[0]).toMatchObject({
						startTime: 3000,
						endTime: 5000,
					});
					expect(cues[1]).toMatchObject({
						startTime: 3000,
						endTime: 8000,
					});
					expect(cues[2]).toMatchObject({
						startTime: 0,
						endTime: 5000,
					});
				});

				it("should let timestamp cues inherit from an out-of-line region", () => {
					const adapter = new TTMLAdapter();
					const { data: cues } = adapter.parse(`
							<tt xml:lang="en">
								<head>
									<layout>
										<region xml:id="r1" begin="3s" end="5s" />
									</layout>
								</head>
								<body>
									<div>
										<p region="r1">
											<span begin="2.5s">
												Test cue r1
											</span>
											<span begin="5s">
												Test cue r2
											</span>
											<span begin="7s">
												Test cue r3
											</span>
										</p>
									</div>
								</body>
							</tt>
							`);

					/**
					 * No other cues are emitted, as they are outside of region range
					 * (a.k.a. they are not active).
					 */
					expect(cues.length).toBe(1);
					expect(cues[0].startTime).toBe(3000);
					expect(cues[0].endTime).toBe(5000);
					expect(cues[0].region).not.toBeUndefined();
				});
			});

			describe("Inline regions", () => {
				it("should not let cue inherit them from an inline region", () => {
					const adapter = new TTMLAdapter();

					const { data: cues } = adapter.parse(`
						<tt xml:lang="en">
							<body>
								<div>
									<region xml:id="r1" begin="0s" end="1.3s" />
									<p>
										<!-- anonymous span -->
										Paragraph flowed inside r1
									</p>
								</div>
							</body>
						</tt>
					`);

					expect(cues.length).toBe(1);
					expect(cues[0]).toMatchObject({
						content: "Paragraph flowed inside r1",
						startTime: 0,
						endTime: 1300,
					});
				});
			});
		});

		describe("ttp:timeBase 'media'", () => {
			it("should not emit a cue when the paragraph is a direct child of a sequential container with no timing attributes", () => {
				const adapter = new TTMLAdapter();
				const { data: cues } = adapter.parse(`
						<tt ttp:timeBase="media" xml:lang="">
							<body>
								<div begin="0s" timeContainer="seq">
									<p>Test cue</p>
								</div>
							</body>
						</tt>
						`);

				expect(cues.length).toBe(0);
			});

			it("should emit a cue with indefinite duration when the paragraph is inside a par container nested in a sequential one", () => {
				const adapter = new TTMLAdapter();
				const { data: cues } = adapter.parse(`
						<tt ttp:timeBase="media" xml:lang="">
							<body>
								<div begin="0s" timeContainer="seq">
									<div>
										<p>Test cue</p>
									</div>
								</div>
							</body>
						</tt>
						`);

				expect(cues.length).toBe(1);
				expect(cues[0]).toMatchObject({
					startTime: 0,
					endTime: Infinity,
				});
			});

			it("should not emit a cue from anonymous span with active duration of 0s when parent is sequential", () => {
				const adapter = new TTMLAdapter();
				const { data: cues } = adapter.parse(`
						<tt ttp:timeBase="media" xml:lang="">
							<body>
								<div>
									<p begin="0s" timeContainer="seq">
										Test cue 1
									</p>
								</div>
							</body>
						</tt>
						`);

				expect(cues.length).toBe(0);
			});

			it("should emit a cue from anonymous span with active duration of 3s when parent is sequential", () => {
				const adapter = new TTMLAdapter();
				const { data: cues } = adapter.parse(`
						<tt ttp:timeBase="media" xml:lang="">
							<body>
								<div begin="0s" timeContainer="seq">
									<p dur="3s">Test cue 1</p>
								</div>
							</body>
						</tt>
						`);

				expect(cues.length).toBe(1);
				expect(cues[0]).toMatchObject({
					startTime: 0,
					endTime: 3000,
				});
			});

			it("should offset each paragraph begin by the accumulated duration of its preceding siblings in a sequential container", () => {
				/**
				 * referenceBegin for seq containers:
				 * each child element's begin is relative to the end
				 * of the previous sibling (accumulated offset).
				 */
				const adapter = new TTMLAdapter();
				const { data: cues } = adapter.parse(`
					<tt ttp:timeBase="media" xml:lang="">
						<body>
							<div begin="0s" timeContainer="seq">
								<p dur="3s">First</p>
								<p dur="2s">Second</p>
							</div>
						</body>
					</tt>
				`);

				expect(cues.length).toBe(2);
				expect(cues[0]).toMatchObject({ startTime: 0, endTime: 3000 });
				/* referenceBegin for Second = end of First = 3s */
				expect(cues[1]).toMatchObject({ startTime: 3000, endTime: 5000 });
			});
		});
	});

	describe("Regions", () => {
		it("should emit an element nested inside a parent when both have the same region attribute", () => {
			const adapter = new TTMLAdapter();

			const { data: cues } = adapter.parse(`
					<tt xml:lang="">
						<head>
							<layout>
								<region xml:id="r1" />
							</layout>
						</head>
						<body>
							<div region="r1">
								<p begin="0s" end="5s" region="r1">
									<span>Content</span>
								</p>
							</div>
						</body>
					</tt>
				`);

			expect(cues.length).toBe(1);
			expect(cues[0]).toMatchObject({ content: "Content" });
		});

		it("should not emit an element containing an inline region, nested inside a parent with a region attribute", () => {
			{
				/**
				 * Testing <body> flowed inside region r1 and
				 * <p> flowed inside inline region
				 */

				const adapter = new TTMLAdapter();

				const { data: cues } = adapter.parse(
					`
							<tt xml:lang="en">
								<head>
									<layout>
										<region xml:id="r1" backgroundColor="red" />
									</layout>
								</head>
								<body>
									<div region="r1">
										<p>
											<region backgroundColor="blue" />
											<span>Unemitted cue</span>
										</p>
									</div>
									<div>
										<p region="r1">
											<region> <!-- This will make ignore the whole <p> element -->
												<style tts:backgroundColor="#FFF" />
											</region>
											<span xml:id="el1">
												Content omitted because has both regions
											</span>
										</p>
										<p region="r1"> <!-- This will get used instead -->
											<span xml:id="el1">
												Content selected because uses only one region
											</span>
										</p>
									</div>
								</body>
							</tt>
						`,
				);

				expect(cues.length).toBe(1);
				expect(cues[0]).toMatchObject({
					content: "Content selected because uses only one region",
				});
			}

			{
				/**
				 * Testing <div> flowed inside region r1 and
				 * <p> flowed inside inline region
				 */

				const adapter = new TTMLAdapter();

				adapter.parse(
					`
							<tt xml:lang="en">
								<head>
									<layout>
										<region xml:id="r1" backgroundColor="red" />
									</layout>
								</head>
								<body>
									<div region="r1">
										<p>
											<region backgroundColor="blue" />
											<span>Unemitted cue</span>
										</p>
									</div>
								</body>
							</tt>
						`,
				);
			}

			{
				/**
				 * Testing <p> flowed inside region r1 and
				 * <span> flowed inside inline region
				 */

				const adapter = new TTMLAdapter();

				adapter.parse(
					`
							<tt xml:lang="en">
								<head>
									<layout>
										<region xml:id="r1" backgroundColor="red" />
									</layout>
								</head>
								<body>
									<div>
										<p region="r1">
											<span>
												<region backgroundColor="blue" />
												Unemitted cue
											</span>
										</p>
									</div>
								</body>
							</tt>
						`,
				);
			}

			{
				/**
				 * Testing <body> flowed inside region r1 and
				 * <div> flowed inside inline region
				 */

				const adapter = new TTMLAdapter();

				adapter.parse(
					`
							<tt xml:lang="en">
								<head>
									<layout>
										<region xml:id="r1" backgroundColor="red" />
									</layout>
								</head>
								<body region="r1">
									<div>
										<region backgroundColor="blue" />
									</div>
								</body>
							</tt>
						`,
				);
			}
		});
	});

	it("should not consider inline regions defined in middle of other elements (order is important)", () => {
		/**
		 * Testing <body> flowed inside region r1 and
		 * <div> flowed inside inline region
		 */

		const adapter = new TTMLAdapter();

		adapter.parse(
			`
							<tt xml:lang="en">
								<head>
									<layout>
										<region xml:id="r1" backgroundColor="red" />
									</layout>
								</head>
								<body>
									<div>
										<p>Test</p>
										<!-- This should get ignored. TTML defines they should be inserted before the rest of the children -->
										<region backgroundColor="blue" />
										<p>Test2</p>
									</div>
								</body>
							</tt>
						`,
		);
	});

	it("should apply inline tts:* styles from a span element onto the cue", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<layout>
						<region xml:id="r1" />
					</layout>
				</head>
				<body>
					<div region="r1">
						<p begin="0s" end="1s">
							<span tts:color="blue" tts:fontSize="14px">Hello</span>
						</p>
					</div>
				</body>
			</tt>
		`);

		const cue = cues.find((c) => c.content.trim() === "Hello");
		const styles = cue?.entities.find(Entities.isLocalStyleEntity)?.styles;
		expect(styles?.["color"]).toBe("blue");
		expect(styles?.["font-size"]).toBe("14px");
	});

	describe("parseCue", () => {
		function parse(xml) {
			return new TTMLAdapter().parse(xml).data;
		}

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
		/*
		 * Unit tests for ttp:cellResolution attribute parsing live in Scope.spec.mjs
		 * under the DocumentContext describe block.
		 *
		 * Integration test for font-size cell-to-pixel conversion:
		 * requires tts:extent on <tt> to derive cell pixel dimensions.
		 * Formula: 1c = extent_height_px / cellResolution_rows
		 */
		it("should convert a cell-sized font to pixels using extent and cellResolution", () => {
			const cues = new TTMLAdapter().parse(`
				<tt xml:lang="en"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
					tts:extent="480px 320px"
					ttp:cellResolution="32 15"
				>
					<head>
						<layout>
							<region xml:id="r1" />
						</layout>
					</head>
						<body>
						<div region="r1">
							<p begin="0s" end="1s">
								<span tts:fontSize="1c">text</span>
							</p>
						</div>
					</body>
				</tt>
			`).data;
			const styles = cues[0]?.entities.find((e) => "styles" in e)?.styles;
			/* 1c = extent_width / rows = 480px / 15 = 32px */
			expect(styles?.["font-size"]).toBe("32px");
		});
	});

	it("should not corrupt the scope chain when non-scope-creating nodes close", () => {
		/*
		 * Non-content-module elements (region, layout, etc.) without timing
		 * do not own a scope. Their closing tag must not pop treeScope.
		 *
		 * Here r1 (timed) creates and then correctly restores treeScope.
		 * r2 (untimed) must leave treeScope untouched on close.
		 * If it did pop, </layout> would advance treeScope to undefined,
		 * causing the next element to throw before producing any cue.
		 */
		const { data: cues } = new TTMLAdapter().parse(`
			<tt xml:lang="">
				<head>
					<layout>
						<region xml:id="r1" begin="0s" end="2s" />
						<region xml:id="r2" />
					</layout>
				</head>
				<body>
					<div region="r1">
						<p>Hello</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBe(1);
		expect(cues[0].startTime).toBe(0);
		expect(cues[0].endTime).toBe(2000);
	});

	it("should correctly pop treeScope when a scope-creating non-content node closes", () => {
		/*
		 * Non-content-module elements WITH timing create a scope that must be
		 * popped on close. If the pop is skipped (old bug: isNodeSkippedScopeCreation
		 * returned true → popped when it shouldn't), subsequent sibling elements
		 * would read stale scope state and inherit wrong timing.
		 *
		 * Here r1 and r2 are both timed. Each creates its own scope during parsing.
		 * After r1 closes, treeScope must be restored to the layout level so r2's
		 * begin/end are resolved independently and not stacked on r1's scope.
		 */
		const { data: cues } = new TTMLAdapter().parse(`
			<tt xml:lang="">
				<head>
					<layout>
						<region xml:id="r1" begin="0s" end="2s" />
						<region xml:id="r2" begin="4s" end="6s" />
					</layout>
				</head>
				<body>
					<div>
						<p begin="0s" end="2s" region="r1">Hello</p>
						<p begin="4s" end="6s" region="r2">World</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBe(2);
		expect(cues[0].startTime).toBe(0);
		expect(cues[0].endTime).toBe(2000);
		expect(cues[1].startTime).toBe(4000);
		expect(cues[1].endTime).toBe(6000);
	});
});
// #endregion

// #region Regions
describe("Regions", () => {
	it("Should ignore nested elements that have a region attribute different from parent's", () => {
		const track = `
<tt xml:lang="en">
	<head>
		<layout>
			<region xml:id="r1"></region>
			<region xml:id="r2" />
			<region xml:id="r3" ></region>
		</layout>
	</head>
	<body>
		<div>
			<p>
				<span xml:id="el1" region="r1">
					<!-- Will be used as parents doesn't define any region, hence "body > div > p > span" structure is replicated under r1 -->
					Content of span flowed inside r1
					<span xml:id="el1.1" region="r2">
						<!-- Will be pruned, because of mismatch with r1 above -->
						Content of span flowed inside r2
					</span>
				</span>
				<span xml:id="el2">
					<!-- Will be pruned, because there is no default region, a.k.a. there are regions defined above -->
					Content of span not flowed in any region
				</span>
				<span xml:id="el3" region="r3">
					<!-- Will be used as parents doesn't define any region, hence "body > div > p > span" structure is replicated under r3 -->
					Content of span flowed inside r3
					<span>Test nested 1</span>
				</span>
			</p>
		</div>
	</body>
</tt>`;

		const adapter = new TTMLAdapter();

		const { data: cues } = adapter.parse(track);

		expect(cues.length).toBe(3);

		expect(cues[0]).toMatchObject({
			content: "Content of span flowed inside r1",
		});

		expect(cues[1]).toMatchObject({
			content: "Content of span flowed inside r3",
		});

		expect(cues[2]).toMatchObject({
			content: "Test nested 1",
		});
	});

	it("Should ignore elements that have a region attribute when the default region is active", () => {
		const track = `
<tt xml:lang="en">
	<body>
		<region xml:id="r3></region>
		<div>
			<p>
				<span xml:id="el1" region="r1">
					<!-- Will be pruned as parents define an (inline) region, hence "body > div > p > span" structure is not replicated under r3 -->
					Content of span flowed inside r1
					<span xml:id="el1.1" region="r2">
						<!-- Will be pruned, because of mismatch with inline region above -->
						Content of span flowed inside r2
					</span>
				</span>
				<span xml:id="el2">
					<!-- Will be used, because a region is defined above -->
					Content of span el2 flowed in the inline region
				</span>
				<span xml:id="el3" region="r3">
					<!-- Will be pruned as parents doesn't define any region, hence "body > div > p > span" structure is replicated under r3 -->
					Content of span flowed inside r3
				</span>
			</p>
		</div>
	</body>
</tt>`;

		const adapter = new TTMLAdapter();

		const { data: cues } = adapter.parse(track);

		expect(cues.length).toBe(1);
		expect(cues[0]).toMatchObject({
			content: "Content of span el2 flowed in the inline region",
		});
	});

	it("should assign the span's region to the cue when region is on a deeply nested span (ISD rule 3)", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<layout>
						<region xml:id="r1" begin="0s" dur="5s" />
					</layout>
				</head>
				<body>
					<div>
						<p>
							<span><span region="r1">Hello</span></span>
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBeGreaterThan(0);
		expect(cues[0].region).toBeDefined();
		expect(cues[0].region.id).toBe("r1");
	});

	it("should assign the span's region to the cue when parent <p> has no region (ISD rule 3)", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<layout>
						<region xml:id="r1" begin="0s" dur="5s" />
					</layout>
				</head>
				<body>
					<div>
						<p>
							<span region="r1">Hello</span>
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBeGreaterThan(0);
		expect(cues[0].region).toBeDefined();
		expect(cues[0].region.id).toBe("r1");
	});

	it("should assign correct regions to sibling spans each one level deep and flowing into different regions", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<layout>
						<region xml:id="r1" begin="0s" dur="5s" />
						<region xml:id="r2" begin="0s" dur="5s" />
					</layout>
				</head>
				<body>
					<div>
						<p>
							<span><span region="r1">Hello</span></span>
							<span><span region="r2">World</span></span>
						</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBe(2);
		expect(cues[0].region).toBeDefined();
		expect(cues[0].region.id).toBe("r1");
		expect(cues[0].content).toBe("Hello");
		expect(cues[1].region).toBeDefined();
		expect(cues[1].region.id).toBe("r2");
		expect(cues[1].content).toBe("World");
	});

	it("should read tts:origin and tts:extent from a region into getOrigin() and width", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<layout>
						<region xml:id="r1"
							tts:origin="10% 20%"
							tts:extent="80% 60%"
							begin="0s"
							end="5s"
						/>
					</layout>
				</head>
				<body>
					<div>
						<p region="r1" begin="0s" end="5s">Hello</p>
					</div>
				</body>
			</tt>
		`);

		expect(cues.length).toBeGreaterThan(0);
		const region = cues[0].region;

		expect(region).toBeDefined();
		expect(region.getOrigin()).toEqual(["10%", "20%"]);
		expect(region.width).toBe("80%");
	});
});
// #endregion

// #region Animations
describe("Animations", () => {
	describe("display: none + <set tts:display>", () => {
		it("should emit one cue per span, timed to the animation window, not the paragraph", () => {
			/**
			 * Three spans, each initially display:none, each revealed by a
			 * <set> for 1 second. The <p> begins at 3s.
			 *
			 * Span 1: set begin="1s" dur="1s"  → absolute 4000–5000 ms
			 * Span 2: set begin="2s" dur="1s"  → absolute 5000–6000 ms
			 * Span 3: set begin="3s" dur="1s"  → absolute 6000–7000 ms
			 */
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" />
						</layout>
					</head>
					<body>
						<div region="r1">
							<p begin="3s">
								<span tts:display="none">
									<set begin="1s" dur="1s" tts:display="auto"/>
									Beautiful soup,
								</span>
								<span tts:display="none">
									<set begin="2s" dur="1s" tts:display="auto"/>
									so rich and green,
								</span>
								<span tts:display="none">
									<set begin="3s" dur="1s" tts:display="auto"/>
									waiting in a hot tureen!
								</span>
							</p>
						</div>
					</body>
				</tt>
			`);

			// Each span produces exactly one cue, shifted to its animation window.
			const textCues = cues.filter((c) => c.content.trim().length > 0);

			expect(textCues.length).toBe(3);

			expect(textCues[0]).toMatchObject({
				startTime: 4000,
				endTime: 5000,
			});
			expect(textCues[0].content.trim()).toBe("Beautiful soup,");

			expect(textCues[1]).toMatchObject({
				startTime: 5000,
				endTime: 6000,
			});
			expect(textCues[1].content.trim()).toBe("so rich and green,");

			expect(textCues[2]).toMatchObject({
				startTime: 6000,
				endTime: 7000,
			});
			expect(textCues[2].content.trim()).toBe("waiting in a hot tureen!");
		});

		it("should not include display:none in the cue's style entity when revealed by animation", () => {
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" />
						</layout>
					</head>
					<body>
						<div region="r1">
							<p begin="0s" end="5s">
								<span tts:display="none">
									<set begin="1s" dur="3s" tts:display="auto"/>
									Hello
								</span>
							</p>
						</div>
					</body>
				</tt>
			`);

			const textCues = cues.filter((c) => c.content.trim().length > 0);
			expect(textCues.length).toBeGreaterThan(0);

			const localStyleEntity = textCues[0].entities.find(
				(e) => "styles" in e && !("duration" in e),
			);
			expect(localStyleEntity).toBeDefined();
			expect(localStyleEntity.styles["display"]).toBeUndefined();
		});

		it("should not emit a cue for a span that is permanently hidden (no display animation)", () => {
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<body>
						<div>
							<p begin="0s" end="5s">
								<span tts:display="none">Never shown</span>
								<span>Visible</span>
							</p>
						</div>
					</body>
				</tt>
			`);

			const textCues = cues.filter((c) => c.content.trim().length > 0);
			expect(textCues.every((c) => c.content.trim() !== "Never shown")).toBe(true);
		});
	});

	describe("visibility: hidden + <set tts:visibility>", () => {
		/**
		 * From the TTML2 spec §10.3.13 example.
		 *
		 * Unlike display:none, visibility:hidden preserves layout space —
		 * the element is still rendered in the timeline. Cue timing follows
		 * the parent <p>, not the <set> animation window.
		 */
		it("should emit one cue per span covering the full paragraph duration", () => {
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" />
						</layout>
					</head>
					<body>
						<div region="r1">
							<p region="r1" begin="0s" dur="4s">
								<span tts:visibility="hidden">
									<set begin="1s" tts:visibility="visible"/>
									Curiouser
								</span>
								<span tts:visibility="hidden">
									<set begin="2s" tts:visibility="visible"/>
									and
								</span>
								<span tts:visibility="hidden">
									<set begin="3s" tts:visibility="visible"/>
									curiouser!
								</span>
							</p>
						</div>
					</body>
				</tt>
			`);

			const textCues = cues.filter((c) => c.content.trim().length > 0);

			expect(textCues.length).toBe(3);

			/* All spans are visible in the layout throughout the paragraph */
			expect(textCues[0]).toMatchObject({ startTime: 0, endTime: 4000 });
			expect(textCues[1]).toMatchObject({ startTime: 0, endTime: 4000 });
			expect(textCues[2]).toMatchObject({ startTime: 0, endTime: 4000 });
		});

		it("should include visibility:hidden in each cue's local style", () => {
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" />
						</layout>
					</head>
					<body>
						<div region="r1">
							<p region="r1" begin="0s" dur="4s">
								<span tts:visibility="hidden">
									<set begin="1s" tts:visibility="visible"/>
									Curiouser
								</span>
							</p>
						</div>
					</body>
				</tt>
			`);

			const textCues = cues.filter((c) => c.content.trim().length > 0);
			expect(textCues.length).toBeGreaterThan(0);

			const localStyleEntity = textCues[0].entities.find(Entities.isLocalStyleEntity);
			expect(localStyleEntity).toBeDefined();
			expect(localStyleEntity.styles["visibility"]).toBe("hidden");
		});

		it("should attach a discrete animation entity that sets visibility:visible at the right delay", () => {
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" />
						</layout>
					</head>
					<body>
						<div region="r1">
							<p region="r1" begin="0s" dur="4s">
								<span tts:visibility="hidden">
									<set begin="1s" tts:visibility="visible"/>
									Curiouser
								</span>
								<span tts:visibility="hidden">
									<set begin="2s" tts:visibility="visible"/>
									and
								</span>
								<span tts:visibility="hidden">
									<set begin="3s" tts:visibility="visible"/>
									curiouser!
								</span>
							</p>
						</div>
					</body>
				</tt>
			`);

			const textCues = cues.filter((c) => c.content.trim().length > 0);

			for (const [index, delay] of [
				[0, 1000],
				[1, 2000],
				[2, 3000],
			]) {
				const animEntity = textCues[index].entities.find(Entities.isAnimationEntity);
				expect(animEntity).toBeDefined();
				expect(animEntity.kind).toBe("discrete");
				expect(animEntity.styles["visibility"]).toBeDefined();
				expect(animEntity.delay).toBe(delay);
			}
		});
	});

	describe("TTML Continuous Animations - Linear", () => {
		it("should animate tts:color correctly", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:color="red;green;blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
			expect(entity.styles["color"]).toBeDefined();
		});

		it("should silently drop tts:border when width/style change in a continuous animation", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:border="1px solid black;2px dotted red;3px dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should silently drop tts:border when only style changes in a continuous animation", () => {
			/* border-style changes across keyframes — validateAnimation returns false, style is silently dropped */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:border="solid black;dotted red;dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should silently drop tts:textOutline when thickness changes in a continuous animation", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:textOutline="red 1px;green 2px;blue 3px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		it("should animate tts:textOutline correctly with only color changes", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:textOutline="red 1px;red 1px;blue 1px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
		});

		it("should silently drop tts:border with missing required components", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:border="solid;dotted;dashed"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeUndefined();
		});

		it("should animate tts:textShadow correctly with only color changes", () => {
			/* tts:textShadow syntax: <length> <length> [<color>]? — color goes last */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:textShadow="1px 1px red;1px 1px green;1px 1px blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
		});

		it("should silently drop tts:textShadow with continuous change in non-animatable components", () => {
			/* offset changes across keyframes — validateAnimation returns false, style silently dropped */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		describe("keyTimes", () => {
			it("should animate tts:color with keyTimes", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:color="red;green;blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
				expect(entity.keyTimes).toEqual([0, 0.5, 1]);
			});

			it("should silently drop tts:color when keyTimes count does not match value count", () => {
				/* 3 keyTimes but only 2 color values — style dropped, no remaining styles, no entity */
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:color="red;green"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeUndefined();
			});

			it("should silently drop styles with mismatched value counts across attributes", () => {
				/* color has 2 values, backgroundColor has 4 — both dropped, no entity */
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:color="red;green" tts:backgroundColor="cyan;magenta;yellow;black"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeUndefined();
			});

			it("should report an error when keySplines is defined on a linear animation", () => {
				const { errors } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1" tts:color="red;green;blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				expect(errors.some((e) => e.error instanceof KeySplinesNotAllowedError)).toBe(true);
			});

			it("should infer keyTimes when not provided", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" tts:color="red;green;blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
				expect(entity.keyTimes).toEqual([0, 0.5, 1]);
			});

			it("should animate tts:color with more than 3 keyTimes", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.33;0.66;1" tts:color="red;green;blue;yellow"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
				expect(entity.keyTimes).toEqual([0, 0.33, 0.66, 1]);
			});

			it("should animate tts:border correctly with only color changes and starting point", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.33;0.66;1" tts:border="2px solid black;2px solid green;2px solid blue;2px solid red"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
				expect(entity.styles?.["border-color"]).toBeDefined();
			});
		});
	});

	describe("TTML Continuous Animations - Paced", () => {
		it("should animate tts:color correctly with paced timing", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:color="red;green;blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
			expect(entity.styles["color"]).toBeDefined();
		});

		it("should silently drop tts:border when width/style changes in a paced animation", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:border="1px solid black;2px dotted red;3px dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should silently drop tts:border with only style changes in a paced animation", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:border="solid black;dotted red;dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should silently drop tts:textOutline when thickness changes in a paced animation", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:textOutline="red 1px;green 2px;blue 3px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		it("should animate tts:textOutline correctly with only color changes with paced timing", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:textOutline="red 1px;red 1px;blue 1px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
		});

		it("should silently drop invalid tts:border and tts:textOutline with missing required components", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:border="solid;dotted;dashed"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeUndefined();
		});

		it("should animate tts:textShadow correctly with only color changes with paced timing", () => {
			/* tts:textShadow syntax: <length> <length> [<color>]? — color goes last */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:textShadow="1px 1px red;1px 1px green;1px 1px blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
		});

		it("should silently drop tts:textShadow when offset changes in a paced animation", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		it("should report an error when keyTimes is defined on a paced animation", () => {
			const { errors } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" keyTimes="0;0.5;1" tts:color="red;green;blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			expect(errors.some((e) => e.error instanceof KeyTimesPacedNotAllowedError)).toBe(true);
		});

		it("should silently drop attributes with a value count that doesn't match the first attribute's count in paced animation", () => {
			/*
			 * TTML2 §13.1.1 constraint 5 only applies when keyTimes is specified and
			 * calcMode is not "paced". For paced without keyTimes the spec is silent
			 * on cross-attribute value count consistency.
			 * The library independently derives an implicit keyframe count from the
			 * first attribute (color: 2 values) and drops any other attribute whose
			 * count differs (backgroundColor: 4 values).
			 */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:color="red;green" tts:backgroundColor="cyan;magenta;yellow;black"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.styles["color"]).toBeDefined();
			expect(entity.styles?.["background-color"]).toBeUndefined();
		});

		it("should animate tts:border correctly with only color changes and starting point with paced timing", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="paced" tts:border="2px solid black;2px solid green;2px solid blue;2px solid red"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.styles?.["border-color"]).toBeDefined();
		});
	});

	describe("TTML Continuous Animations - Spline", () => {
		it("should animate tts:color correctly with spline timing", () => {
			/* 3 keyTimes → 2 keySplines required (N-1) */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:color="red;green;blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
			expect(entity.splines).toHaveLength(2);
			expect(entity.styles["color"]).toBeDefined();
		});

		it("should silently drop tts:border when width/style change in a spline animation", () => {
			/* 1 keySpline is valid here because 2 keyTimes → 1 spline (N-1) would be correct,
			 * but this test has 3 keyTimes → need to use 2 keySplines for this to not throw */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:border="1px solid black;2px dotted red;3px dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should silently drop tts:textOutline when thickness changes in a spline animation", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:textOutline="red 1px;green 2px;blue 3px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		it("should silently drop tts:textShadow when offset changes in a spline animation", () => {
			/* 1 keySpline ok here: this test already has correct 1 keySpline for its 2-interval range,
			 * but we have 3 keyTimes → needs 2. Keeping the original correct-count version. */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		it("should animate tts:border correctly with only color changes with spline timing", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:border="2px solid black;2px solid red;2px solid blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.styles?.["border-color"]).toBeDefined();
		});

		it("should animate tts:textOutline correctly with only color changes with spline timing", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:textOutline="red 1px;red 1px;blue 1px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
		});

		it("should animate tts:textShadow correctly with only color changes with spline timing", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.25 0.1 0.25 1;0 0 0.58 1" calcMode="spline" tts:textShadow="1px 1px red;1px 1px green;1px 1px blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("continuous");
		});

		it("should animate tts:border correctly with only color changes and starting point with spline timing", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 1 1;0 0 1 1" calcMode="spline" tts:border="2px solid black;2px solid green;2px solid blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.styles?.["border-color"]).toBeDefined();
		});

		it("should properly parse valid keySplines", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.1 0.8 0.2 0.8" calcMode="spline" tts:color="red;green;blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.splines).toEqual([
				[0.42, 0, 0.58, 1],
				[0.1, 0.8, 0.2, 0.8],
			]);
		});

		it("should throw when keySplines count does not match keyTimes count minus one", () => {
			/* 3 keyTimes → needs 2 keySplines, but only 1 provided */
			expect(() =>
				new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1" calcMode="spline" tts:color="red;green;blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`),
			).toThrow(KeySplinesAmountNotMatchingKeyTimesError);
		});

		it("should throw when keySplines control points are not exactly 4", () => {
			expect(() =>
				new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58;0.1 0.8 0.9" calcMode="spline" tts:color="red;green;blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`),
			).toThrow(KeySplinesInvalidControlsAmountError);
		});

		it("should throw when a keySplines coordinate is out of [0,1] range", () => {
			expect(() =>
				new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1.2;0.1 0.8 0.9 0.2" calcMode="spline" tts:color="red;green;blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`),
			).toThrow(KeySplinesCoordinateOutOfBoundaryError);
		});

		it("should report an error when calcMode is spline but keySplines is missing", () => {
			const { errors } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" calcMode="spline" tts:color="red;green;blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			expect(errors.some((e) => e.error instanceof KeySplinesRequiredError)).toBe(true);
		});

		it("should silently drop tts:border when width/style change in a spline animation (duplicate set)", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0 0 1 1" calcMode="spline" tts:border="1px solid black;2px dotted red;3px dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should silently drop tts:textOutline when thickness changes in a spline animation (duplicate set)", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.25 0.1 0.25 1;0.42 0 0.58 1" calcMode="spline" tts:textOutline="red 1px;green 2px;blue 3px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});

		it("should silently drop tts:textShadow when offset changes in a spline animation (duplicate set)", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" keySplines="0.1 0.8 0.2 0.8;0.25 0.1 0.25 1" calcMode="spline" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["text-shadow"]).toBeUndefined();
		});
	});

	describe("TTML Repeated Animations", () => {
		describe("repeatCount", () => {
			it("should animate tts:color with repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" repeatCount="3" tts:color="red;green;blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
				expect(entity.styles["color"]).toBeDefined();
			});

			it("should silently drop tts:border when width/style change with repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" repeatCount="3" tts:border="1px solid black;2px dotted red;3px dashed blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity?.styles?.["border-color"]).toBeUndefined();
			});

			it("should silently drop tts:border with only style changes and repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" repeatCount="3" tts:border="solid black;dotted red;dashed blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity?.styles?.["border-color"]).toBeUndefined();
			});

			it("should silently drop tts:textOutline when thickness changes with repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" repeatCount="3" tts:textOutline="red 1px;green 2px;blue 3px"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity?.styles?.["text-shadow"]).toBeUndefined();
			});

			it("should animate tts:textOutline correctly with only color changes and repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" repeatCount="3" tts:textOutline="red 1px;red 1px;blue 1px"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
			});

			it("should silently drop invalid tts:border with missing components and repeatCount", () => {
				/* border dropped — no remaining styles, no entity */
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" repeatCount="3" tts:border="solid;dotted;dashed"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeUndefined();
			});

			it("should animate tts:textShadow correctly with only color changes and repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" repeatCount="3" tts:textShadow="1px 1px red;1px 1px green;1px 1px blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
			});

			it("should silently drop tts:textShadow when offset changes with repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" repeatCount="3" tts:textShadow="1px 1px red;2px 2px green;3px 3px blue"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity?.styles?.["text-shadow"]).toBeUndefined();
			});

			it("should animate tts:color with more than 3 keyTimes and repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.33;0.66;1" repeatCount="3" tts:color="red;green;blue;yellow"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
				expect(entity.keyTimes).toHaveLength(4);
			});

			it("should silently drop tts:border with non-uniform style changes and 4 keyTimes and repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.33;0.66;1" repeatCount="3" tts:border="solid black;dotted red;dashed blue;double green"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity?.styles?.["border-color"]).toBeUndefined();
			});

			it("should animate tts:textOutline with more than 3 keyTimes and repeatCount", () => {
				const { data: cues } = new TTMLAdapter().parse(`
					<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
						<head>
							<layout>
								<region xml:id="r1" begin="0s" end="5s"/>
							</layout>
						</head>
						<body>
							<div>
								<p xml:id="p1" region="r1" begin="0s" end="5s">
									<animate xml:id="a1" dur="5s" keyTimes="0;0.25;0.5;0.75;1" repeatCount="3" tts:textOutline="red 1px;red 1px;blue 1px;blue 1px;green 1px"/>
									Text
								</p>
							</div>
						</body>
					</tt>
				`);
				const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
				expect(entity).toBeDefined();
			});
		});
	});

	describe("TTML Discrete Animations", () => {
		it("should animate tts:border with discrete changes", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="discrete" tts:border="1px solid black;2px dotted red;3px dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("discrete");
		});

		it("should animate tts:textOutline with discrete changes", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="discrete" tts:textOutline="red 1px;green 2px;blue 3px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("discrete");
		});

		it("should silently drop styles with invalid discrete values (missing components)", () => {
			/* tts:border needs both style and color; bare style tokens are invalid */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="discrete" tts:border="1px solid;2px dotted;3px dashed"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
		});

		it("should animate tts:border with keyTimes in discrete mode", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" calcMode="discrete" tts:border="1px solid black;2px dotted red;3px dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("discrete");
			expect(entity.keyTimes).toHaveLength(3);
		});

		it("should animate tts:textOutline with keyTimes in discrete mode", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" calcMode="discrete" tts:textOutline="red 1px;green 2px;blue 3px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("discrete");
			expect(entity.keyTimes).toHaveLength(3);
		});

		it("should silently drop styles with mismatched value counts across attributes", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" calcMode="discrete" keyTimes="0;0.5;1" tts:border="1px solid black;2px dotted red" tts:textOutline="red 1px;green 2px;blue 3px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
		});

		it("should silently drop tts:border when keyTimes count does not match value count", () => {
			/*
			 * 3 keyTimes but only 2 values — count mismatch causes style to be dropped.
			 */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.5;1" tts:border="1px solid black;2px dotted red"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity?.styles?.["border-color"]).toBeUndefined();
		});

		it("should animate tts:border with more than 3 keyTimes in discrete mode", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.33;0.66;1" calcMode="discrete" tts:border="1px solid black;2px dotted red;3px dashed blue;4px double green"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.keyTimes).toHaveLength(4);
		});

		it("should animate tts:textOutline with more than 3 keyTimes in discrete mode", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="5s"/>
						</layout>
					</head>
					<body>
						<div>
							<p xml:id="p1" region="r1" begin="0s" end="5s">
								<animate xml:id="a1" dur="5s" keyTimes="0;0.33;0.66;1" calcMode="discrete" tts:textOutline="red 1px;green 2px;blue 3px;yellow 4px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.keyTimes).toHaveLength(4);
		});

		it("should animate tts:border with discrete changes using <set>", () => {
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="3s"/>
						</layout>
					</head>
					<body>
						<div>
							<p region="r1" begin="0s" end="3s">
								<set begin="0s" dur="1s" tts:border="1px solid black"/>
								<set begin="1s" dur="1s" tts:border="2px dotted red"/>
								<set begin="2s" dur="1s" tts:border="3px dashed blue"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("discrete");
		});

		it("should animate tts:textOutline with discrete changes using <set>", () => {
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling">
					<head>
						<layout>
							<region xml:id="r1" begin="0s" end="3s"/>
						</layout>
					</head>
					<body>
						<div>
							<p region="r1" begin="0s" end="3s">
								<set begin="0s" dur="1s" tts:textOutline="red 1px"/>
								<set begin="1s" dur="1s" tts:textOutline="green 2px"/>
								<set begin="2s" dur="1s" tts:textOutline="blue 3px"/>
								Text
							</p>
						</div>
					</body>
				</tt>
			`);
			const entity = cues[0]?.entities?.find(Entities.isAnimationEntity);
			expect(entity).toBeDefined();
			expect(entity.kind).toBe("discrete");
		});
	});

	describe("Region animations", () => {
		it("should produce a continuous animation entity on the region for <animate> tts:opacity", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" tts:opacity="0">
								<animate dur="1s" tts:opacity="0;1"/>
							</region>
						</layout>
					</head>
					<body>
						<div region="r1">
							<p begin="0s" dur="1s">Text</p>
						</div>
					</body>
				</tt>
			`);

			const region = cues[0]?.region;
			expect(region).toBeDefined();
			const animEntity = region.entities.find(Entities.isAnimationEntity);
			expect(animEntity).toBeDefined();
			expect(animEntity.kind).toBe("continuous");
			expect(animEntity.styles["opacity"]).toBeDefined();
		});

		it("should produce a discrete animation entity on the region for <set> tts:origin", () => {
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1">
								<set dur="3s" tts:origin="80px 580px"/>
							</region>
						</layout>
					</head>
					<body>
						<div region="r1">
							<p begin="0s" dur="3s">Text</p>
						</div>
					</body>
				</tt>
			`);

			const region = cues[0]?.region;
			expect(region).toBeDefined();
			const animEntity = region.entities.find(Entities.isAnimationEntity);
			expect(animEntity).toBeDefined();
			expect(animEntity.kind).toBe("discrete");
			/* tts:origin maps to "x" and "y" CSS properties */
			expect(animEntity.styles["x"]).toBeDefined();
			expect(animEntity.styles["y"]).toBeDefined();
		});

		it("should compute animation delay relative to the region's own begin, not absolute document time", () => {
			/*
			 * A region with begin="2s" contains an <animate> with no explicit begin.
			 * The animation starts at the region's start, so delay must be 0ms —
			 * not 2000ms, which would result from subtracting regionStart=0 (root
			 * TimeContext) instead of regionStart=2000 (the region's own TimeContext).
			 */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" begin="2s" dur="4s">
								<animate dur="2s" tts:opacity="0;1"/>
							</region>
						</layout>
					</head>
					<body>
						<div region="r1">
							<p begin="2s" dur="4s">Text</p>
						</div>
					</body>
				</tt>
			`);

			const region = cues[0]?.region;
			expect(region).toBeDefined();
			const animEntity = region.entities.find(Entities.isAnimationEntity);
			expect(animEntity).toBeDefined();
			expect(animEntity.delay).toBe(0);
			expect(animEntity.duration).toBe(2000);
		});

		it("should offset sequential region animations by the accumulated duration of preceding siblings", () => {
			/*
			 * timeContainer="seq" on region: each animation starts when the previous ends.
			 * Two <animate dur="4s"> → first.delay=0ms, second.delay=4000ms.
			 *
			 * Known bug: buildContexts crashes with a null access on <animate> children
			 * of a region with timeContainer="seq" (RegionContainerContext.ts:295).
			 */
			const { data: cues } = new TTMLAdapter().parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" timeContainer="seq">
								<animate dur="4s" tts:backgroundColor="rgba(0,0,0,0.8);rgba(255,0,0,0.8)"/>
								<animate dur="4s" tts:backgroundColor="rgba(255,0,0,0.8);rgba(0,0,255,0.8)"/>
							</region>
						</layout>
					</head>
					<body>
						<div region="r1">
							<p begin="0s" dur="8s">Text</p>
						</div>
					</body>
				</tt>
			`);

			const region = cues[0]?.region;
			expect(region).toBeDefined();
			const animEntities = region.entities.filter(Entities.isAnimationEntity);
			expect(animEntities.length).toBe(2);
			expect(animEntities[0].delay).toBe(0);
			expect(animEntities[0].duration).toBe(4000);
			expect(animEntities[1].delay).toBe(4000);
			expect(animEntities[1].duration).toBe(4000);
		});
	});

	describe("<set> single-value constraint (§13.1.3 + §13.3.1)", () => {
		it("should report an error and still emit the cue when tts:color contains a semicolon-separated list", () => {
			/**
			 * §13.1.3 specifies that <set> targets a single <animation-value>.
			 * §13.3.1 defines <animation-value> as a token that must not contain
			 * an unescaped semicolon — that separator belongs to <animation-value-list>
			 * (§13.3.2), which is the syntax for <animate>, not <set>.
			 */
			const { data: cues, errors } = new TTMLAdapter().parse(`
				<tt xml:lang="en"
					xmlns="http://www.w3.org/ns/ttml"
					xmlns:tts="http://www.w3.org/ns/ttml#styling"
				>
					<head>
						<layout>
							<region xml:id="r1" />
						</layout>
					</head>
					<body>
						<div region="r1">
							<p begin="0s" dur="2s">
								<span>
									<set begin="0s" dur="2s" tts:color="red;green"/>
									Hello world
								</span>
							</p>
						</div>
					</body>
				</tt>
			`);

			/* The cue must still be emitted — bad animation must not swallow the cue. */
			const textCues = cues.filter((c) => c.content.trim().length > 0);
			expect(textCues.length).toBeGreaterThan(0);

			/* A non-critical error must be reported for the illegal animation-value-list. */
			expect(errors.length).toBeGreaterThan(0);
			expect(errors.every((e) => !e.isCritical)).toBe(true);
		});
	});
});
// #endregion

// #region Style
describe("Style inheritance", () => {
	function getStyleEntity(cue) {
		return cue.entities.find(Entities.isLocalStyleEntity);
	}

	it("merges a linear style chain onto the cue", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<styling>
						<style xml:id="s1" tts:color="red" />
						<style xml:id="s2" style="s1" tts:fontSize="12px" />
						<style xml:id="s3" style="s2" tts:fontWeight="bold" />
					</styling>
					<layout><region xml:id="r1" /></layout>
				</head>
				<body>
					<div region="r1">
						<p begin="0s" end="1s" style="s3">Hello</p>
					</div>
				</body>
			</tt>
		`);

		const cue = cues.find((c) => c.content.trim() === "Hello");
		const styles = getStyleEntity(cue)?.styles;
		expect(styles["color"]).toBe("red");
		expect(styles["font-size"]).toBe("12px");
	});

	it("own attributes override inherited ones", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<styling>
						<style
							xml:id="s1"
							tts:fontSize="12px"
							tts:color="red"
						/>
						<style
							xml:id="s2"
							style="s1" 
							tts:color="blue"
						/>
					</styling>
					<layout>
						<region xml:id="r1" />
					</layout>
				</head>
				<body>
					<div region="r1">
						<p begin="0s" end="1s" style="s2">Hello</p>
					</div>
				</body>
			</tt>
		`);

		const cue = cues.find((c) => c.content.trim() === "Hello");
		const styles = getStyleEntity(cue)?.styles;
		expect(styles["color"]).toBe("blue");
		expect(styles["font-size"]).toBe("12px");
	});

	it("resolves a diamond dependency without duplicating properties", () => {
		/**
		 *    s1
		 *   /  \
		 * s2    s3
		 *   \  /
		 *    s4
		 */

		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<styling>
						<style xml:id="s1" tts:color="red" />
						<style xml:id="s2" style="s1" tts:fontSize="12px" />
						<style xml:id="s3" style="s1" tts:opacity="0.5" />
						<style xml:id="s4" style="s2 s3" tts:backgroundColor="white" />
					</styling>
					<layout>
						<region xml:id="r1" />
					</layout>
				</head>
				<body>
					<div region="r1">
						<p begin="0s" end="1s" style="s4">Hello</p>
					</div>
				</body>
			</tt>
		`);

		const cue = cues.find((c) => c.content.trim() === "Hello");
		const styles = getStyleEntity(cue)?.styles;
		expect(styles["color"]).toBe("red");
		expect(styles["font-size"]).toBe("12px");
		expect(styles["opacity"]).toBe("0.5");
		expect(styles["background-color"]).toBe("white");
	});

	it("merges multiple directly referenced styles onto the cue", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<styling>
						<style xml:id="s1" tts:color="red" tts:fontSize="12px" />
						<style xml:id="s2" tts:opacity="0.5" tts:fontSize="16px" />
					</styling>
					<layout>
						<region xml:id="r1" />
					</layout>
				</head>
				<body>
					<div region="r1">
						<p begin="0s" end="1s" style="s1 s2">Hello</p>
					</div>
				</body>
			</tt>
		`);

		const cue = cues.find((c) => c.content.trim() === "Hello");
		const styles = getStyleEntity(cue)?.styles;
		expect(styles["color"]).toBe("red");
		expect(styles["opacity"]).toBe("0.5");
	});

	it("ignores cyclic style references", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<styling>
						<style xml:id="s1" style="s2" tts:color="red" />
						<style xml:id="s2" style="s1" tts:fontSize="12px" />
						<style xml:id="s3" tts:opacity="0.8" />
					</styling>
					<layout><region xml:id="r1" /></layout>
				</head>
				<body>
					<div region="r1">
						<p begin="0s" end="1s" style="s3">Hello</p>
					</div>
				</body>
			</tt>
		`);

		const cue = cues.find((c) => c.content.trim() === "Hello");
		const styles = getStyleEntity(cue)?.styles;
		/* s1 and s2 form a cycle — neither resolves, only s3 (independent) contributes */
		expect(styles["color"]).toBeUndefined();
		expect(styles["font-size"]).toBeUndefined();
		expect(styles["opacity"]).toBe("0.8");
	});

	it("does not expose a style defined inside a region to elements outside it", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<layout>
						<region xml:id="r1">
							<style xml:id="s1" tts:color="red" />
						</region>
						<region xml:id="r2" />
					</layout>
				</head>
				<body>
					<div region="r2">
						<!-- s1 is scoped to r1; referencing it from r2 should silently fail -->
						<p begin="0s" end="1s" style="s1">Hello</p>
					</div>
				</body>
			</tt>
		`);

		const cue = cues.find((c) => c.content.trim() === "Hello");
		const styles = getStyleEntity(cue)?.styles;
		expect(styles?.["color"]).toBeUndefined();
	});

	it("should allow a region-nested style to inherit from a global style via the style attribute", () => {
		const adapter = new TTMLAdapter();
		const { data: cues } = adapter.parse(`
			<tt xml:lang="en">
				<head>
					<styling>
						<style xml:id="global" tts:color="red" />
					</styling>
					<layout>
						<region xml:id="r1">
							<style xml:id="s1" style="global" tts:fontSize="12px" />
						</region>
					</layout>
				</head>
				<body>
					<div region="r1">
						<p begin="0s" end="1s" style="s1">Hello</p>
					</div>
				</body>
			</tt>
		`);

		const cue = cues.find((c) => c.content.trim() === "Hello");
		const styles = getStyleEntity(cue)?.styles;
		/* s1 defines fontSize; it inherits color from the global out-of-line style */
		expect(styles?.["color"]).toBe("red");
		expect(styles?.["font-size"]).toBe("12px");
	});
});
// #endregion

// #region Time Container
describe("Time container", () => {
	function cuesWithContent(cues) {
		return cues.filter((c) => c.content.trim().length > 0);
	}

	describe("sequential (seq)", () => {
		it("first child in seq starts at 0 when no explicit begin", () => {
			const cues = new TTMLAdapter().parse(`
				<tt xml:lang="" ttp:timeBase="media">
					<body>
						<div begin="0s" timeContainer="seq">
							<p dur="3s">First</p>
						</div>
					</body>
				</tt>
			`).data;
			expect(cues[0]).toMatchObject({ startTime: 0, endTime: 3000 });
		});

		it("second child starts at the active end of the first", () => {
			const cues = cuesWithContent(
				new TTMLAdapter().parse(`
					<tt xml:lang="" ttp:timeBase="media">
						<body>
							<div begin="0s" timeContainer="seq">
								<p dur="3s">First</p>
								<p dur="2s">Second</p>
							</div>
						</body>
					</tt>
				`).data,
			);
			expect(cues[0]).toMatchObject({ startTime: 0, endTime: 3000 });
			expect(cues[1]).toMatchObject({ startTime: 3000, endTime: 5000 });
		});

		it("accumulates across three siblings", () => {
			const cues = cuesWithContent(
				new TTMLAdapter().parse(`
					<tt xml:lang="" ttp:timeBase="media">
						<body>
							<div begin="0s" timeContainer="seq">
								<p dur="2s">A</p>
								<p dur="3s">B</p>
								<p dur="1s">C</p>
							</div>
						</body>
					</tt>
				`).data,
			);
			expect(cues[0]).toMatchObject({ startTime: 0, endTime: 2000 });
			expect(cues[1]).toMatchObject({ startTime: 2000, endTime: 5000 });
			expect(cues[2]).toMatchObject({ startTime: 5000, endTime: 6000 });
		});

		it("explicit begin on a child is relative to referenceBegin, not absolute", () => {
			/*
			 * Per TTML2 spec, a child's explicit begin is still interpreted
			 * relative to the referenceBegin of its seq container slot.
			 * First child: referenceBegin=0, begin="1s" → startTime=1000
			 * Second child: referenceBegin=end of first=4000ms, begin="1s" → startTime=5000
			 */
			const cues = cuesWithContent(
				new TTMLAdapter().parse(`
					<tt xml:lang="" ttp:timeBase="media">
						<body>
							<div begin="0s" timeContainer="seq">
								<p begin="1s" dur="3s">First</p>
								<p begin="1s" dur="2s">Second</p>
							</div>
						</body>
					</tt>
				`).data,
			);
			expect(cues[0]).toMatchObject({ startTime: 1000, endTime: 4000 });
			expect(cues[1]).toMatchObject({ startTime: 5000, endTime: 7000 });
		});
	});

	describe("parallel (par)", () => {
		it("siblings in a par container share the same reference point", () => {
			const cues = cuesWithContent(
				new TTMLAdapter().parse(`
					<tt xml:lang="" ttp:timeBase="media">
						<body>
							<div>
								<p begin="0s" dur="3s">First</p>
								<p begin="0s" dur="2s">Second</p>
							</div>
						</body>
					</tt>
				`).data,
			);
			expect(cues[0]).toMatchObject({ startTime: 0, endTime: 3000 });
			/* par: Second is NOT offset by First */
			expect(cues[1]).toMatchObject({ startTime: 0, endTime: 2000 });
		});
	});
});
// #endregion
