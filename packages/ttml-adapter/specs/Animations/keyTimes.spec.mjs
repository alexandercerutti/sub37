import { describe, it, expect } from "@jest/globals";
import {
	getKeyTimes,
	getInferredPacedKeyTimesByAmount,
	assertKeyTimesBeginIsZero,
	assertKeyTimesEndIsOne,
} from "../../lib/Parser/Animations/keyTimes/index.js";
import { KeyTimesFirstValueNotZeroError } from "../../lib/Parser/Animations/keyTimes/KeyTimesFirstValueNotZeroError.js";
import { KeyTimesLastValueNotOneError } from "../../lib/Parser/Animations/keyTimes/KeyTimesLastValueNotOneError.js";
import { KeyTimesComponentOutOfBoundaryError } from "../../lib/Parser/Animations/keyTimes/KeyTimesComponentOutOfBoundaryError.js";
import { KeyTimesAscendingOrderViolationError } from "../../lib/Parser/Animations/keyTimes/KeyTimesAscendingOrderViolationError.js";

describe("getKeyTimes", () => {
	it("returns an empty array when value is falsy", () => {
		expect(getKeyTimes(undefined)).toEqual([]);
		expect(getKeyTimes("")).toEqual([]);
	});

	it("parses a valid semicolon-separated keyTimes string", () => {
		expect(getKeyTimes("0;0.5;1")).toEqual([0, 0.5, 1]);
	});

	it("parses four keyTimes evenly spaced", () => {
		expect(getKeyTimes("0;0.33;0.66;1")).toEqual([0, 0.33, 0.66, 1]);
	});

	it("throws when the first value is not 0", () => {
		expect(() => getKeyTimes("0.1;0.5;1")).toThrow(KeyTimesFirstValueNotZeroError);
	});

	it("throws when a value is below 0", () => {
		expect(() => getKeyTimes("0;-0.1;1")).toThrow(KeyTimesComponentOutOfBoundaryError);
	});

	it("throws when a value is above 1", () => {
		expect(() => getKeyTimes("0;0.5;1.1")).toThrow(KeyTimesComponentOutOfBoundaryError);
	});

	it("throws when values are not in ascending order", () => {
		expect(() => getKeyTimes("0;0.8;0.5;1")).toThrow(KeyTimesAscendingOrderViolationError);
	});
});

describe("getInferredPacedKeyTimesByAmount", () => {
	it("infers [0, 1] for amount 2", () => {
		expect(getInferredPacedKeyTimesByAmount(2)).toEqual([0, 1]);
	});

	it("infers [0, 0.5, 1] for amount 3", () => {
		expect(getInferredPacedKeyTimesByAmount(3)).toEqual([0, 0.5, 1]);
	});

	it("infers [0, 0.25, 0.5, 0.75, 1] for amount 5", () => {
		const result = getInferredPacedKeyTimesByAmount(5);
		expect(result).toHaveLength(5);
		expect(result[0]).toBe(0);
		expect(result[4]).toBe(1);
		/*
		 * Floating-point sums may drift slightly; check proximities
		 * rather than exact equality for intermediate values.
		 */
		expect(result[2]).toBeCloseTo(0.5);
	});
});

describe("assertKeyTimesBeginIsZero", () => {
	it("does not throw when first value is 0", () => {
		expect(() => assertKeyTimesBeginIsZero([0, 0.5, 1])).not.toThrow();
	});

	it("throws when first value is not 0", () => {
		expect(() => assertKeyTimesBeginIsZero([0.1, 0.5, 1])).toThrow(KeyTimesFirstValueNotZeroError);
	});
});

describe("assertKeyTimesEndIsOne", () => {
	it("does not throw when last value is 1", () => {
		expect(() => assertKeyTimesEndIsOne([0, 0.5, 1])).not.toThrow();
	});

	it("throws when last value is not 1", () => {
		expect(() => assertKeyTimesEndIsOne([0, 0.5, 0.9])).toThrow(KeyTimesLastValueNotOneError);
	});
});
