// @ts-check
import { describe, it, expect } from "@jest/globals";
import { Entities } from "../lib/index.js";

describe("Tag entities", () => {
	describe("Setting styles", () => {
		it("should return empty object if not a string or an object", () => {
			const entity = new Entities.Tag({
				attributes: new Map(),
				classes: [],
				length: 0,
				offset: 0,
				tagType: Entities.TagType.BOLD,
			});

			// @ts-expect-error
			entity.setStyles();

			entity.setStyles(undefined);

			// @ts-expect-error
			entity.setStyles(null);

			// @ts-expect-error
			entity.setStyles(0);

			expect(entity.styles).toEqual({});
		});
	});
});
