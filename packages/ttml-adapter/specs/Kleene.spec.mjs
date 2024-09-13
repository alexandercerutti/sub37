import { describe, it, expect } from "@jest/globals";
import * as Kleene from "../lib/Parser/Tags/Representation/kleene.js";

describe("Kleene", () => {
	/**
	 * @param {string} nodeName
	 * @returns {boolean}
	 */

	function matches(nodeName) {
		return true;
	}

	describe("ZeroOrMore (*)", () => {
		it("should match multiple sequential instances of the same node", () => {
			const operator = Kleene.zeroOrMore({
				nodeName: "test",
				destinationFactory: () => [],
				matches,
			});

			expect(operator.matches("test")).toBe(true);
			expect(operator.matches("test")).toBe(true);
			expect(operator.matches("test")).toBe(true);
		});

		it("should delegate the matching function to a child operator", () => {
			const operator = Kleene.zeroOrMore(
				Kleene.or(
					{
						nodeName: "testA",
						destinationFactory: () => [],
						matches(nodeName) {
							return nodeName === "testA";
						},
					},
					{
						nodeName: "testB",
						destinationFactory: () => [],
						matches(nodeName) {
							return nodeName === "testB";
						},
					},
				),
			);

			expect(operator.matches("testC")).toBe(false);
			expect(operator.matches("testA")).toBe(true);
			expect(operator.matches("testB")).toBe(true);
		});
	});

	describe("OneOrMore (+)", () => {
		it("should match multiple sequential instances of the same node", () => {
			const operator = Kleene.oneOrMore({
				nodeName: "test",
				destinationFactory: () => [],
				matches,
			});

			expect(operator.matches("test")).toBe(true);
			expect(operator.matches("test")).toBe(true);
			expect(operator.matches("test")).toBe(true);
		});

		it("should throw an error if the first element of its kind is not found", () => {
			const operator = Kleene.oneOrMore({
				nodeName: "test",
				destinationFactory: () => [],
				matches,
			});

			expect(() => operator.matches("test1")).toThrowError();
		});

		it("should not throw an error if an element is found now and not found later", () => {
			const operator = Kleene.oneOrMore({
				nodeName: "test",
				destinationFactory: () => [],
				matches,
			});

			expect(operator.matches("test")).toBe(true);
			expect(operator.matches("test1")).toBe(false);
		});

		it("should delegate the matching function to a child operator", () => {
			const operator = Kleene.oneOrMore(
				Kleene.or(
					{
						nodeName: "testA",
						destinationFactory: () => [],
						matches(nodeName) {
							return nodeName === "testA";
						},
					},
					{
						nodeName: "testB",
						destinationFactory: () => [],
						matches() {
							return false;
						},
					},
				),
			);

			expect(operator.matches("testA")).toBe(true);
			expect(operator.matches("testB")).toBe(false);
			expect(operator.matches("testC")).toBe(false);
		});
	});

	describe("ZeroOrOne (?)", () => {
		it("should match only the first instance of a node", () => {
			const operator = Kleene.zeroOrOne({
				nodeName: "test",
				destinationFactory: () => [],
				matches,
			});

			expect(operator.matches("test")).toBe(true);
			expect(operator.matches("test")).toBe(false);
		});

		it("should delegate the matching function to a child operator", () => {
			const operator = Kleene.zeroOrOne(
				Kleene.or(
					{
						nodeName: "testA",
						destinationFactory: () => [],
						matches(nodeName) {
							return nodeName === "testA";
						},
					},
					{
						nodeName: "testB",
						destinationFactory: () => [],
						matches() {
							return true;
						},
					},
				),
			);

			expect(operator.matches("testA")).toBe(true);
			expect(operator.matches("testB")).toBe(false);
			expect(operator.matches("testC")).toBe(false);
		});
	});
});
