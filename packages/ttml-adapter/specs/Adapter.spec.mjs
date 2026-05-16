import { describe, it, expect } from "@jest/globals";
import { Entities } from "@sub37/server";
import TTMLAdapter from "../lib/Adapter.js";

// https://developer.mozilla.org/en-US/docs/Related/IMSC/Subtitle_placement

describe("Adapter", () => {
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

		it("should apply inline tts:* styles from a span element onto the cue", () => {
			const adapter = new TTMLAdapter();
			const { data: cues } = adapter.parse(`
				<tt xml:lang="en">
					<head><layout><region xml:id="r1" /></layout></head>
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
						xmlns:tts="http://www.w3.org/ns/ttml#styling">
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
						xmlns:tts="http://www.w3.org/ns/ttml#styling">
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
						xmlns:tts="http://www.w3.org/ns/ttml#styling">
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
	});

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
						<layout><region xml:id="r1" /></layout>
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
						<layout><region xml:id="r1" /></layout>
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
						<layout><region xml:id="r1" /></layout>
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
});
