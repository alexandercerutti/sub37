// @ts-check
/// <reference types="chai" />

import WebVTTRenderer from "../lib/Renderer.js";

describe("WebVTTRenderer", () => {
	/** @type {WebVTTRenderer} */
	let renderer;

	beforeEach(() => {
		renderer = new WebVTTRenderer();
	});

	it("should always return a supported type", () => {
		chai.expect(WebVTTRenderer.supportedType).to.eql("text/vtt");
	});
});
