// @ts-check
import { describe, it, expect } from "@jest/globals";
import { Entities } from "../lib/index.js";

describe("Tag entities", () => {
	it("Building a tag entity, should not alter the properties", () => {
		const entity = Entities.createTagEntity(Entities.TagType.BOLD, new Map());

		expect(entity.attributes).toEqual(new Map());
		expect(entity.classes).toEqual([]);
		expect(entity.tagType).toBe(Entities.TagType.BOLD);
		expect(entity.type).toBe(2);
	});
});
