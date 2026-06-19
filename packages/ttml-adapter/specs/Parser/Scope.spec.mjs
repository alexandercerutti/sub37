import { describe, it, expect, jest } from "@jest/globals";
import TTMLAdapter from "../../lib/Adapter.js";
import { parseResult } from "../helpers/parseResult.mjs";
import { createScope, onMergeSymbol } from "../../lib/Parser/Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "../../lib/Parser/Scope/TimeContext.js";
import {
	createStyleContainerContext,
	readScopeStyleContainerContext,
} from "../../lib/Parser/Scope/StyleContainerContext.js";
import {
	createRegionContainerContext,
	readScopeRegionContext,
} from "../../lib/Parser/Scope/RegionContainerContext.js";
import {
	createDocumentContext,
	readScopeDocumentContext,
} from "../../lib/Parser/Scope/DocumentContext.js";
import { NodeTree } from "../../lib/Parser/Tags/NodeTree.js";
import { nodeScopeSymbol } from "../../lib/Adapter.js";

/**
 * @typedef {import("../../lib/Parser/Scope/Scope.js").Context<ContentType>} Context<ContentType>
 * @template {string[]} ContentType
 */

/**
 * @typedef {Context<ContentType> & { content: ContentType; exposed_mockedSymbol?: symbol }} MockedContextExtension<ContentType>
 * @template {string[]} ContentType
 */

/**
 * @callback mockedContext
 * @param {Array<string>} [contents]
 * @returns {MockedContextExtension | null}
 */

describe("Scope and contexts", () => {
	describe("Scope", () => {
		it("should accept several contexts as input", () => {
			const mockedContext = () => {
				const mockedContextSymbol = Symbol("mockedContextSymbol");

				const contextFactory = (_scope) => {
					// @ts-ignore
					contextFactory.exposedContext = {
						identifier: mockedContextSymbol,
						get content() {
							return [];
						},
						get exposed_mockedSymbol() {
							return mockedContextSymbol;
						},
					};

					// @ts-ignore
					return contextFactory.exposedContext;
				};

				contextFactory.exposedSymbol = mockedContextSymbol;

				return contextFactory;
			};

			const contexts = [mockedContext(), mockedContext(), mockedContext(), mockedContext()];
			const scope = createScope(undefined, ...contexts);

			expect(scope.getAllContexts().length).toBe(4);
			expect(scope.getContextByIdentifier(contexts[0].exposedSymbol)).toEqual(
				// @ts-ignore
				contexts[0].exposedContext,
			);
			expect(scope.getContextByIdentifier(contexts[1].exposedSymbol)).toEqual(
				// @ts-ignore
				contexts[1].exposedContext,
			);
			expect(scope.getContextByIdentifier(contexts[2].exposedSymbol)).toEqual(
				// @ts-ignore
				contexts[2].exposedContext,
			);
			expect(scope.getContextByIdentifier(contexts[3].exposedSymbol)).toEqual(
				// @ts-ignore
				contexts[3].exposedContext,
			);
		});

		it("should merge two contexts with the same identifier", () => {
			const mockedContextSymbol = Symbol("mockedContextSymbol");
			const mockedContext = (contents) => {
				return (_scope) => {
					return {
						identifier: mockedContextSymbol,
						get content() {
							return contents;
						},
						get args() {
							return [];
						},

						/**
						 *
						 * @param {MockedContextExtension<string[]>} incomingContext
						 */

						[onMergeSymbol](incomingContext) {
							contents.push(...incomingContext.content);
						},
					};
				};
			};

			const contexts = [mockedContext(["a", "b", "c", "d"]), mockedContext(["e", "f", "g", "h"])];
			const scope = createScope(undefined, contexts[0]);

			scope.addContexts(contexts[1]);

			expect(scope.getAllContexts().length).toBe(1);
			expect(
				// @ts-ignore
				scope.getContextByIdentifier(mockedContextSymbol).content,
			).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
		});

		it("should merge two contexts with the same identifier when a parent is available", () => {
			const mockedContextSymbol = Symbol("mockedContextSymbol");
			const mockedContext = (contents) => {
				return (_scope) => {
					return {
						ownContents: contents,
						parent: undefined,
						identifier: mockedContextSymbol,
						get content() {
							return contents;
						},
						get args() {
							return [];
						},

						/**
						 *
						 * @param {MockedContextExtension<string[]>} incomingContext
						 */

						[onMergeSymbol](incomingContext) {
							// @ts-ignore
							contents.push(...incomingContext.content);
						},
					};
				};
			};

			const contexts = [
				mockedContext(["a", "b", "c", "d"]),
				mockedContext(["e", "f", "g", "h"]),
				mockedContext(["j", "k", "l", "m"]),
			];
			const scope = createScope(undefined, contexts[0]);
			const scope2 = createScope(scope, contexts[1], contexts[2]);

			expect(scope2.getAllContexts().length).toBe(1);
			expect(
				// @ts-ignore
				scope2.getContextByIdentifier(mockedContextSymbol).content,
			).toEqual(["e", "f", "g", "h", "j", "k", "l", "m"]);
		});
	});

	describe("TimeContext", () => {
		/**
		 * - On an element specifying both "dur" and "end", should win the
		 * 				Math.min(dur, end - begin). Test both cases.
		 */
		describe("endTime is the minimum of end and dur (same element)", () => {
			it("unit", () => {
				const scope = createScope(
					undefined,
					createDocumentContext(new NodeTree(), { "xml:lang": "" }),
					createTimeContext({
						end: "10s",
						dur: "20s",
					}),
				);

				expect(readScopeTimeContext(scope).endTime).toBe(10000);
			});

			it("integration", () => {
				const cues = parseResult(
					new TTMLAdapter(),
					`
					<tt xml:lang="">
						<body>
							<div>
								<p>
									<span end="10s" dur="20s">text</span>
								</p>
							</div>
						</body>
					</tt>
				`,
				).data;
				expect(cues[0].endTime).toBe(10000);
			});
		});

		describe("endTime is the minimum of end and dur (across scopes)", () => {
			it("unit", () => {
				const scope1 = createScope(
					undefined,
					createDocumentContext(new NodeTree(), { "xml:lang": "" }),
					createTimeContext({
						end: "20s",
					}),
				);

				const scope2 = createScope(
					scope1,
					createTimeContext({
						dur: "15s",
					}),
				);

				expect(readScopeTimeContext(scope2).endTime).toBe(15000);
			});

			it("integration", () => {
				const cues = parseResult(
					new TTMLAdapter(),
					`
					<tt xml:lang="">
						<body>
							<div>
								<p end="20s">
									<span dur="15s">text</span>
								</p>
							</div>
						</body>
					</tt>
				`,
				).data;
				expect(cues[0].endTime).toBe(15000);
			});
		});

		describe("endTime respects begin offset when comparing dur vs end", () => {
			it("unit", () => {
				const scope1 = createScope(
					undefined,
					createDocumentContext(new NodeTree(), { "xml:lang": "" }),
					createTimeContext({
						begin: "5s",
						end: "20s",
					}),
				);

				const scope2 = createScope(
					scope1,
					createTimeContext({
						dur: "16s",
					}),
				);

				expect(readScopeTimeContext(scope2).endTime).toBe(20000);
			});

			it("integration", () => {
				const cues = parseResult(
					new TTMLAdapter(),
					`
					<tt xml:lang="">
						<body>
							<div>
								<p begin="5s" end="20s">
									<span dur="16s">text</span>
								</p>
							</div>
						</body>
					</tt>
				`,
				).data;
				expect(cues[0].endTime).toBe(20000);
			});
		});

		describe("endTime is Infinity when neither dur nor end are specified in a par container", () => {
			it("unit", () => {
				const scope = createScope(
					undefined,
					createDocumentContext(new NodeTree(), { "xml:lang": "" }),
					createTimeContext({
						timeContainer: "par",
					}),
				);

				expect(readScopeTimeContext(scope).endTime).toBe(Infinity);
			});
		});

		describe("endTime is 0 when neither dur nor end are specified in a seq container", () => {
			it("unit", () => {
				const nodeTree = new NodeTree();

				const seqContainerScope = createScope(
					undefined,
					createDocumentContext(nodeTree, { "xml:lang": "" }),
					createTimeContext({ timeContainer: "seq" }),
				);

				/*
				 * Simulate the adapter's nodeTree state just before a child element
				 * of the seq container would have its TimeContext attached: push a node
				 * that carries the seq container's scope (matching production behaviour)
				 * so currentNode is non-null with no children yet (= no prior siblings).
				 */
				nodeTree.push({ [nodeScopeSymbol]: seqContainerScope });

				const childScope = createScope(seqContainerScope, createTimeContext({ begin: "0s" }));

				expect(readScopeTimeContext(childScope).endTime).toBe(0);
			});

			it("integration", () => {
				/*
				 * Text must be a direct child of the seq <p>, not wrapped in a <span>.
				 * A child <span> gets its own TimeContext with state.timeContainer=undefined,
				 * so its anonymous text reads "par" from the span's state — not "seq" from <p>.
				 */
				const cues = parseResult(
					new TTMLAdapter(),
					`
					<tt xml:lang="">
						<body>
							<div>
								<p timeContainer="seq">text</p>
							</div>
						</body>
					</tt>
				`,
				).data;
				expect(cues.length).toBe(0);
			});
		});
	});

	describe("RegionContainerContext", () => {
		function makeRegion(id, extraAttrs = {}) {
			return { attributes: { "xml:id": id, ...extraAttrs }, children: [] };
		}

		it("should return undefined for an unknown idref", () => {
			const scope = createScope(undefined, createRegionContainerContext([makeRegion("r1")]));
			expect(readScopeRegionContext(scope).getRegionById("unknown")).toBeUndefined();
		});

		it("should return undefined when idref is not provided", () => {
			const scope = createScope(undefined, createRegionContainerContext([makeRegion("r1")]));
			expect(readScopeRegionContext(scope).getRegionById(undefined)).toBeUndefined();
		});

		it("should find a region by its id", () => {
			const scope = createScope(
				undefined,
				createRegionContainerContext([makeRegion("r1"), makeRegion("r2")]),
			);
			const region = readScopeRegionContext(scope).getRegionById("r1");
			expect(region).toBeDefined();
			expect(region.id).toBe("r1");
		});

		it("should expose all registered regions through .regions", () => {
			const scope = createScope(
				undefined,
				createRegionContainerContext([makeRegion("r1"), makeRegion("r2")]),
			);
			const ids = readScopeRegionContext(scope).regions.map((r) => r.id);
			expect(ids).toEqual(["r1", "r2"]);
		});

		it("should skip regions without an xml:id", () => {
			const scope = createScope(
				undefined,
				createRegionContainerContext([{ attributes: {}, children: [] }, makeRegion("r1")]),
			);
			expect(readScopeRegionContext(scope).regions.length).toBe(1);
			expect(readScopeRegionContext(scope).regions[0].id).toBe("r1");
		});

		it("should return null when contextState is empty", () => {
			const scope = createScope(undefined, createRegionContainerContext([]));
			expect(readScopeRegionContext(scope)).toBeUndefined();
		});

		it("should accumulate regions from a merged context", () => {
			const scope = createScope(undefined, createRegionContainerContext([makeRegion("r1")]));
			scope.addContexts(createRegionContainerContext([makeRegion("r2")]));
			const ids = readScopeRegionContext(scope).regions.map((r) => r.id);
			expect(ids).toContain("r1");
			expect(ids).toContain("r2");
		});

		it("should find a region from a parent scope", () => {
			const parent = createScope(undefined, createRegionContainerContext([makeRegion("r1")]));
			const child = createScope(parent, createRegionContainerContext([makeRegion("r2")]));
			expect(readScopeRegionContext(child).getRegionById("r1")).toBeDefined();
			expect(readScopeRegionContext(child).getRegionById("r2")).toBeDefined();
		});
	});

	describe("StyleContext", () => {
		it("should merge multiple style contexts on the same scope", () => {
			const scope = createScope(
				undefined,
				createStyleContainerContext([
					{
						"xml:id": "t1",
						"tts:textColor": "blue",
						"tts:backgroundColor": "rose",
						kind: "inline",
					},
				]),
				createStyleContainerContext([
					{
						"xml:id": "t2",
						"tts:textColor": "blue",
						kind: "inline",
					},
				]),
			);

			expect(readScopeStyleContainerContext(scope).getStyleByIDRef("t1")).toMatchObject({
				"xml:id": "t1",
				styleAttributes: {
					"tts:textColor": "blue",
					"tts:backgroundColor": "rose",
				},
			});

			expect(readScopeStyleContainerContext(scope).getStyleByIDRef("t2")).toMatchObject({
				"xml:id": "t2",
				styleAttributes: {
					"tts:textColor": "blue",
				},
			});
		});
	});

	describe("DocumentContext", () => {
		describe("ttp:cellResolution", () => {
			it("should default to [32, 15] when not specified", () => {
				const scope = createScope(
					undefined,
					createDocumentContext(new NodeTree(), { "xml:lang": "" }),
				);
				expect(readScopeDocumentContext(scope).attributes["ttp:cellResolution"]).toEqual([32, 15]);
			});

			it("should default to [32, 15] when columns or rows are below 1", () => {
				const scope = createScope(
					undefined,
					createDocumentContext(new NodeTree(), {
						"xml:lang": "",
						"ttp:cellResolution": "0 -5",
					}),
				);
				expect(readScopeDocumentContext(scope).attributes["ttp:cellResolution"]).toEqual([32, 15]);
			});

			it("should use the provided values when valid", () => {
				const scope = createScope(
					undefined,
					createDocumentContext(new NodeTree(), {
						"xml:lang": "",
						"ttp:cellResolution": "40 20",
					}),
				);
				expect(readScopeDocumentContext(scope).attributes["ttp:cellResolution"]).toEqual([40, 20]);
			});
		});
	});
});
