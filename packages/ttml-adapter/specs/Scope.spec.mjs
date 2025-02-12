import { describe, it, expect, jest } from "@jest/globals";
import { createScope } from "../lib/Parser/Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "../lib/Parser/Scope/TimeContext.js";
import {
	createStyleContainerContext,
	readScopeStyleContainerContext,
} from "../lib/Parser/Scope/StyleContainerContext.js";
import { createDocumentContext } from "../lib/Parser/Scope/DocumentContext.js";

/**
 * @typedef {import("../lib/Parser/Scope/Scope.js").Context<ContentType>} Context<ContentType>
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
			const mockedContext = /** @type {Context} */ () => {
				const mockedContextSymbol = Symbol("mockedContextSymbol");

				const contextFactory = (_scope) => {
					contextFactory.exposedContext = {
						identifier: mockedContextSymbol,
						get content() {
							return [];
						},
						get exposed_mockedSymbol() {
							return mockedContextSymbol;
						},
					};

					return contextFactory.exposedContext;
				};

				contextFactory.exposedSymbol = mockedContextSymbol;

				return contextFactory;
			};

			const contexts = [mockedContext(), mockedContext(), mockedContext(), mockedContext()];
			const scope = createScope(undefined, ...contexts);

			expect(scope.getAllContexts().length).toBe(4);
			expect(scope.getContextByIdentifier(contexts[0].exposedSymbol)).toEqual(
				contexts[0].exposedContext,
			);
			expect(scope.getContextByIdentifier(contexts[1].exposedSymbol)).toEqual(
				contexts[1].exposedContext,
			);
			expect(scope.getContextByIdentifier(contexts[2].exposedSymbol)).toEqual(
				contexts[2].exposedContext,
			);
			expect(scope.getContextByIdentifier(contexts[3].exposedSymbol)).toEqual(
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

						/**
						 *
						 * @param {MockedContextExtension<string[]>} context
						 */

						mergeWith(context) {
							contents.push(...context.content);
						},
					};
				};
			};

			const contexts = [mockedContext(["a", "b", "c", "d"]), mockedContext(["e", "f", "g", "h"])];
			const scope = createScope(undefined, contexts[0]);

			scope.addContext(contexts[1]);

			expect(scope.getAllContexts().length).toBe(1);
			expect(scope.getContextByIdentifier(mockedContextSymbol).content).toEqual([
				"a",
				"b",
				"c",
				"d",
				"e",
				"f",
				"g",
				"h",
			]);
		});
	});

	describe("TimeContext", () => {
		/**
		 * - On an element specifying both "dur" and "end", should win the
		 * 				Math.min(dur, end - begin). Test both cases.
		 */
		it("should return the minimum between end and dur, on the same context", () => {
			const scope = createScope(
				undefined,
				createDocumentContext({}),
				createTimeContext({
					end: "10s",
					dur: "20s",
				}),
			);

			expect(readScopeTimeContext(scope).endTime).toBe(10000);
		});

		it("should return the minimum between end and dur, on the different contexts", () => {
			const scope1 = createScope(
				undefined,
				createDocumentContext({}),
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

		it("should return the minimum between end - begin and dur plus the startTime, when begin is specified", () => {
			const scope1 = createScope(
				undefined,
				createDocumentContext({}),
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

		it("should return infinity if neither dur and end are specified", () => {
			const scope = createScope(
				undefined,
				createDocumentContext({}),
				createTimeContext({
					timeContainer: "par",
				}),
			);

			expect(readScopeTimeContext(scope).endTime).toBe(Infinity);
		});

		it("should return 0 if neither dur and end are specified but cues are sequential", () => {
			const scope1 = createScope(
				createScope(
					undefined,
					createDocumentContext({}),
					createTimeContext({
						timeContainer: "seq",
					}),
				),
				createTimeContext({
					begin: "0s",
				}),
			);

			expect(readScopeTimeContext(scope1).endTime).toBe(0);
		});
	});

	describe("RegionContext", () => {});

	describe("StyleContext", () => {
		it("should merge multiple style contexts on the same scope, by giving priority to the last. Styles are merged", () => {
			const scope = createScope(
				undefined,
				createStyleContainerContext({
					t1: {
						"xml:id": "t1",
						"tts:textColor": "blue",
						"tts:backgroundColor": "rose",
					},
				}),
				createStyleContainerContext({
					t2: {
						"xml:id": "t2",
						"tts:textColor": "blue",
					},
				}),
			);

			// expect(readScopeStyleContainerContext(scope).styles).toMatchObject(
			// 	new Map([
			// 		[
			// 			"t2",
			// 			{
			// 				attributes: {
			// 					"tts:textColor": "blue",
			// 					"tts:backgroundColor": "rose",
			// 				},
			// 			},
			// 		],
			// 	]),
			// );
		});

		it("should be able to iterate all the parent styles", () => {
			const scope1 = createScope(
				undefined,
				createStyleContainerContext({
					t1: {
						"xml:id": "t1",
						"tts:textColor": "blue",
					},
				}),
			);

			const scope2 = createScope(
				scope1,
				createStyleContainerContext({
					t2: {
						"xml:id": "t2",
						"tts:textColor": "rose",
					},
				}),
			);

			// expect(readScopeStyleContainerContext(scope2).styles).toBeInstanceOf(Map);
			// expect(readScopeStyleContainerContext(scope2).styles).toMatchObject(
			// 	new Map([
			// 		["t1", { id: "t1", attributes: { "tts:textColor": "blue" } }],
			// 		["t2", { id: "t2", attributes: { "tts:textColor": "rose" } }],
			// 	]),
			// );
		});
	});
});
