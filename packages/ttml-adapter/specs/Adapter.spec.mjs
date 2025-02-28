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
			describe("Region timing inheritance", () => {
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

					expect(cues.length).toBe(8);
					expect(cues[0]).toMatchObject({
						startTime: 0,
						endTime: 3000,
					});
					expect(cues[1]).toMatchObject({
						startTime: 3000,
						endTime: 5000,
					});
					expect(cues[2]).toMatchObject({
						startTime: 5000,
						endTime: Infinity,
					});
					expect(cues[3]).toMatchObject({
						startTime: 0,
						endTime: 3000,
					});
					expect(cues[4]).toMatchObject({
						startTime: 3000,
						endTime: 8000,
					});
					expect(cues[5]).toMatchObject({
						startTime: 8000,
						endTime: Infinity,
					});
					expect(cues[6]).toMatchObject({
						startTime: 0,
						endTime: 5000,
					});
					expect(cues[7]).toMatchObject({
						startTime: 5000,
						endTime: Infinity,
					});
				});

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

					expect(cues.length).toBe(2);
					expect(cues[0]).toMatchObject({
						content: "Paragraph flowed inside r1",
						startTime: 0,
						endTime: 1300,
					});
					expect(cues[1]).toMatchObject({
						content: "Paragraph flowed inside r1",
						startTime: 1300,
						endTime: Infinity,
					});
				});
			});

			describe("ttp:timeBase 'media'", () => {
				it("should emit a cue from anonymous span with indefinite active duration when sequential parent doesn't specify a duration", () => {
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

					expect(cues.length).toBe(1);
					expect(cues[0]).toMatchObject({
						startTime: 0,
						endTime: Infinity,
					});
				});

				it("should emit a cue from anonymous span with active duration of 0s when parent is sequential", () => {
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

					expect(cues.length).toBe(1);
					expect(cues[0]).toMatchObject({
						startTime: 0,
						endTime: 0,
					});
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
	});
});

/**
 * @TODO add tests for
 *
 *  - div with multiple regions (only the first should be used)
 *  - p with multiple regions (only the first should be used)
 *  - Nested div and p with a region each, both should be applied to the outcoming cue
 */
