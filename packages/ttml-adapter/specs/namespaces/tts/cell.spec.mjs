// @ts-check

import { describe, expect, it } from "@jest/globals";
import {
	isCellScalar,
	getCellScalarPixelConversion,
	getCellScalarPercentageConversion,
} from "../../../lib/Parser/namespaces/tts/primitives/cell.js";
import { createUnit } from "../../../lib/Parser/Unit.js";

/** @param {number} value */
const c = (value) => createUnit(value, "c");

/** @param {number} value */
const px = (value) => createUnit(value, "px");

describe("isCellScalar", () => {
	it("returns true for a c unit", () => {
		expect(isCellScalar(c(1))).toBe(true);
	});

	it("returns false for a px unit", () => {
		expect(isCellScalar(px(1))).toBe(false);
	});

	it("returns false for a percentage unit", () => {
		expect(isCellScalar(createUnit(50, "%"))).toBe(false);
	});

	it("returns false for non-scalar values", () => {
		expect(isCellScalar(null)).toBe(false);
		expect(isCellScalar(undefined)).toBe(false);
		expect(isCellScalar("1c")).toBe(false);
	});
});

describe("getCellScalarPixelConversion", () => {
	/*
	 * formula: (containerDimension / cellCount) * scalar
	 *
	 * e.g. container=640px, cells=32, scalar=1c → (640/32)*1 = 20px
	 */
	it("converts 1c to px", () => {
		expect(getCellScalarPixelConversion(px(640), 32, c(1))).toMatchObject({
			value: 20,
			metric: "px",
		});
	});

	it("converts a fractional c value", () => {
		expect(getCellScalarPixelConversion(px(480), 15, c(0.5))).toMatchObject({
			value: 16,
			metric: "px",
		});
	});

	it("returns null when the scalar is not a c unit", () => {
		expect(getCellScalarPixelConversion(px(640), 32, px(10))).toBeNull();
	});

	it("returns null for a percentage scalar", () => {
		expect(getCellScalarPixelConversion(px(640), 32, createUnit(50, "%"))).toBeNull();
	});
});

describe("getCellScalarPercentageConversion", () => {
	/*
	 * Two-step conversion: c → px → %
	 *
	 * e.g. container=640px, cells=32, scalar=1c
	 *   step 1: (640/32)*1 = 20px
	 *   step 2: (20/640)*100 = 3.125%
	 *
	 * The intermediate px value cancels with the container, leaving:
	 *   (scalar / cellCount) * 100%
	 */
	it("converts 1c to a container-relative percentage", () => {
		expect(getCellScalarPercentageConversion(px(640), 32, c(1))).toMatchObject({
			value: 3.125,
			metric: "%",
		});
	});

	it("converts 0.5c correctly", () => {
		/*
		 * (480/15)*0.5 = 16px → 16/480 = 3.333...%
		 */
		const result = getCellScalarPercentageConversion(px(480), 15, c(0.5));
		expect(result?.metric).toBe("%");
		expect(result?.value).toBeCloseTo((100 * 16) / 480, 10);
	});

	it("uses the correct axis — width and height produce different results on non-square containers", () => {
		/*
		 * Same scalar (1c), same cell count (32), different container dimensions:
		 *   width axis:  (1920/32)*1 = 60px → 60/1920 = 3.125%
		 *   height axis: (1080/32)*1 = 33.75px → 33.75/1080 ≈ 3.125%   ← same ratio, different px
		 *
		 * Use different cell counts to produce a visible axis difference:
		 *   columns=40: (1920/40)*1 = 48px → 48/1920 = 2.5%
		 *   rows=22:    (1080/22)*1 ≈ 49.09px → ≈ 4.545%
		 */
		const widthResult = getCellScalarPercentageConversion(px(1920), 40, c(1));
		const heightResult = getCellScalarPercentageConversion(px(1080), 22, c(1));

		expect(widthResult?.value).toBeCloseTo(2.5, 5);
		expect(heightResult?.value).toBeCloseTo((100 * (1080 / 22)) / 1080, 5);
		expect(widthResult?.value).not.toBeCloseTo(heightResult?.value ?? 0, 1);
	});

	it("returns null when the scalar is not a c unit", () => {
		expect(getCellScalarPercentageConversion(px(640), 32, px(10))).toBeNull();
	});
});
