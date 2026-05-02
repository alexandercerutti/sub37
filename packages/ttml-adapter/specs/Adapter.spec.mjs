import { describe, it, expect } from "@jest/globals";
import TTMLAdapter from "../lib/Adapter.js";

/**
 * - A document without tt, is not considered a valid document
 *
 * - An XML that does not contain a <tt> element, should throw an error
 *
 * - A style tag gets correctly inherited by another style tag
 * - A style tag gets correctly inherited by a style tag inside a region
 * - A style tag places inside a region should not get inherited
 * - A style tag with an already available id should get a new one (todo: test tree equals --1, --2, --3)
 *
 * - A region tag should be parsed correctly only in layout/head and if it both a self-closing tag or not.
 * - A style tag should be parsed correctly only in stylings and if it both a self-closing tag or not.
 *
 * - Timings:
 * 		- On an element specifying both "dur" and "end", should win the
 * 				Math.min(dur, end - begin). Test both cases.
 * 		- `referenceBegin` on `media` with par and seq
 */

// https://developer.mozilla.org/en-US/docs/Related/IMSC/Subtitle_placement

describe("Adapter", () => {
	it("should throw if the track does not start with a <tt> element", () => {
		const adapter = new TTMLAdapter();
		expect(() => {
			adapter.parse(`
				<head>
					<layout></layout>
				</head>
				<body>
					<div>
						<p>Some Content that won't be used</p>
					</div>
				</body>
			`);
		}).toThrowError();
	});

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
			});
		});

		describe("Region attribute chain", () => {
			it("should emit an element nested inside a parent when both have the same region attribute", () => {});

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

		it.todo("should use inline styles");
	});

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

		it.todo(
			"Should parse and provide region styles" /*() => {
			const track = `
<tt xml:lang="en">
	<head>
		<styling>
			<style xml:id="inheritable_style_1" />
			<style xml:id="inheritable_style_2" />
			<style xml:id="inheritable_style_3" />
		</styling>
		<layout>
			<region xml:id="region_1">
				<style tts:backgroundColor="black" />
				<style tts:color="white" />
				<style tts:border="red" />
			</region>
		</layout>
	</head>
	<body>
			<div>
				<p region="region_1">
					Yep, that's me
					<span>The span you were looking</span>
					for.
				</p>
			</div>
	</body>
</tt>`;

			const adapter = new TTMLAdapter();

			adapter.parse(track);
		}*/,
		);

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
			expect(region.width).toBe(80);
		});
	});
});

/**
 * @TODO add tests for
 *
 *  - div with multiple regions (only the first should be used)
 *  - p with multiple regions (only the first should be used)
 *  - Nested div and p with a region each, both should be applied to the outcoming cue
 */
