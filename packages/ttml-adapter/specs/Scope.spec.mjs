import { describe, it, expect, jest } from "@jest/globals";
import { createScope } from "../lib/Parser/Scope/Scope.js";
import { createTimeContext, readScopeTimeContext } from "../lib/Parser/Scope/TimeContext.js";

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
			const mockedContext = jest.fn(
				/** @type {mockedContext} */ () => {
					const mockedContextSymbol = Symbol("mockedContextSymbol");

					return {
						identifier: mockedContextSymbol,
						get content() {
							return [];
						},
						get exposed_mockedSymbol() {
							return mockedContextSymbol;
						},
					};
				},
			);

			const contexts = [mockedContext(), mockedContext(), mockedContext(), mockedContext()];
			const scope = createScope(undefined, ...contexts);

			expect(scope.getAllContexts().length).toBe(4);
			expect(scope.getContextByIdentifier(contexts[0].exposed_mockedSymbol)).toEqual(contexts[0]);
			expect(scope.getContextByIdentifier(contexts[1].exposed_mockedSymbol)).toEqual(contexts[1]);
			expect(scope.getContextByIdentifier(contexts[2].exposed_mockedSymbol)).toEqual(contexts[2]);
			expect(scope.getContextByIdentifier(contexts[3].exposed_mockedSymbol)).toEqual(contexts[3]);
		});

		it("should merge two contexts with the same identifier", () => {
			const mockedContextSymbol = Symbol("mockedContextSymbol");
			const mockedContext = jest.fn(
				/** @type {mockedContext} */ (contents) => {
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
				},
			);

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
				createTimeContext({
					end: 10,
					dur: 20,
				}),
			);

			expect(readScopeTimeContext(scope).endTime).toBe(10);
		});

		it("should return the minimum between end and dur, on the different contexts", () => {
			const scope1 = createScope(
				undefined,
				createTimeContext({
					end: 20,
				}),
			);

			const scope2 = createScope(
				scope1,
				createTimeContext({
					dur: 15,
				}),
			);

			expect(readScopeTimeContext(scope2).endTime).toBe(15);
		});

		it("should return the minimum between end - begin and dur plus the startTime, when begin is specified", () => {
			const scope1 = createScope(
				undefined,
				createTimeContext({
					begin: 5,
					end: 20,
				}),
			);

			const scope2 = createScope(
				scope1,
				createTimeContext({
					dur: 16,
				}),
			);

			expect(readScopeTimeContext(scope2).endTime).toBe(20);
		});

		it("should return infinity if neither dur and end are specified", () => {
			const scope = createScope(
				undefined,
				createTimeContext({
					timeContainer: "par",
				}),
			);

			expect(readScopeTimeContext(scope).endTime).toBe(Infinity);
		});

		it("should return 0 if neither dur and end are specified but cues are sequential", () => {
			const scope1 = createScope(
				undefined,
				createTimeContext({
					timeContainer: "seq",
				}),
			);

			const scope2 = createScope(
				scope1,
				createTimeContext({
					// just to not make it nullable
					begin: 0,
				}),
			);

			expect(readScopeTimeContext(scope2).endTime).toBe(0);

			/**
			 * Additional test: `timeContainer` is always applied to the
			 * children but not on the element itself
			 */

			expect(readScopeTimeContext(scope1).timeContainer).toBe("par");
			expect(readScopeTimeContext(scope2).timeContainer).toBe("seq");
		});
	});

	describe("RegionContext", () => {});

	describe("StyleContext", () => {});
});
