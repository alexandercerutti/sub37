import { describe, it, expect } from "@jest/globals";
import { getKeySplines } from "../../lib/Parser/Animations/keySplines/index.js";
import { KeySplinesAmountNotMatchingKeyTimesError } from "../../lib/Parser/Animations/keySplines/KeySplinesAmountNotMatchingKeyTimesError.js";
import { KeySplinesInvalidControlsAmountError } from "../../lib/Parser/Animations/keySplines/KeySplinesInvalidControlsAmountError.js";
import { KeySplinesCoordinateOutOfBoundaryError } from "../../lib/Parser/Animations/keySplines/KeySplinesCoordinateOutOfBoundaryError.js";

describe("getKeySplines", () => {
	it("parses a single control for two keyTimes", () => {
		const result = getKeySplines("0.42 0 0.58 1", [0, 1]);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual([0.42, 0, 0.58, 1]);
	});

	it("parses multiple controls — one per interval between keyTimes", () => {
		const result = getKeySplines("0.42 0 0.58 1;0.1 0.8 0.2 0.8", [0, 0.5, 1]);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual([0.42, 0, 0.58, 1]);
		expect(result[1]).toEqual([0.1, 0.8, 0.2, 0.8]);
	});

	it("throws when the number of controls does not match keyTimes count minus one", () => {
		/*
		 * 3 keyTimes → 2 intervals → must have exactly 2 controls.
		 * Providing only 1 should throw.
		 */
		expect(() => getKeySplines("0.42 0 0.58 1", [0, 0.5, 1])).toThrow(
			KeySplinesAmountNotMatchingKeyTimesError,
		);
	});

	it("throws when a control does not contain exactly 4 coordinates", () => {
		expect(() => getKeySplines("0.42 0 0.58", [0, 1])).toThrow(
			KeySplinesInvalidControlsAmountError,
		);
	});

	it("throws when a coordinate is below 0", () => {
		expect(() => getKeySplines("0.42 -0.1 0.58 1", [0, 1])).toThrow(
			KeySplinesCoordinateOutOfBoundaryError,
		);
	});

	it("throws when a coordinate is above 1", () => {
		expect(() => getKeySplines("0.42 0 0.58 1.2", [0, 1])).toThrow(
			KeySplinesCoordinateOutOfBoundaryError,
		);
	});

	it("allows coordinates at the boundary values 0 and 1", () => {
		expect(() => getKeySplines("0 0 1 1", [0, 1])).not.toThrow();
	});
});
