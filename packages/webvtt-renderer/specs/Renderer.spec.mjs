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

	describe("parse", () => {
		const CLASSIC_CONTENT = `
WEBVTT

00:00:05.000 --> 00:00:25.000 region:fred align:left
<v Fred&gt;>Would you like to get &lt; coffee?

00:00:00.000 --> 00:00:20.000 region:fred align:left
<lang.mimmo en-US>Hi, my name is Fred</lang>`;

		const SAME_START_END_TIMES_CONTENT = `
WEBVTT

00:00:05.000 --> 00:00:05.000
This cue should never appear, right?

00:00:06.000 --> 00:00:07.000
...

00:00:08.000 --> 00:00:10.000
...Right?
`;

		const TIMESTAMPS_CUES_CONTENT = `
WEBVTT

00:00:16.000 --> 00:00:24.000
<00:00:16.000> <c.mimmo>This</c>
<00:00:18.000> <c>can</c>
<00:00:20.000> <c>match</c>
<00:00:22.000> <c>:past/:future</c>
<00:00:24.000>
`;

		it("should return an empty array if rawContent is falsy", () => {
			chai.expect(renderer.parse(undefined)).to.eql([]);
			chai.expect(renderer.parse(null)).to.eql([]);
			chai.expect(renderer.parse("")).to.eql([]);
		});

		it("should throw if it receives a string that does not start with 'WEBTT' header", () => {
			const invalidWebVTTError = "Invalid WebVTT file. It should start with string 'WEBVTT'";
			// @ts-expect-error
			chai.expect(() => renderer.parse(true)).to.throw(Error, invalidWebVTTError);
			// @ts-expect-error
			chai.expect(() => renderer.parse(10)).to.throw(Error, invalidWebVTTError);
			chai.expect(() => renderer.parse("Look, a phoenix!")).to.throw(Error, invalidWebVTTError);
		});

		it("should exclude cues with the same start time and end time", () => {
			const result = renderer.parse(SAME_START_END_TIMES_CONTENT);
			chai.expect(result.length).to.eql(2);

			chai.expect(result[0].startTime).to.eql(6000);
			chai.expect(result[0].endTime).to.eql(7000);

			chai.expect(result[1].startTime).to.eql(8000);
			chai.expect(result[1].endTime).to.eql(10000);
		});

		/** @TODO review test. Incongruence in entities type found, between the two returned cues */
		xit("should return an array containing two cues", () => {
			const parsingResult = renderer.parse(CLASSIC_CONTENT);
			chai.expect(parsingResult).to.be.an("array");
			chai.expect(parsingResult.length).to.eql(2);

			console.log(parsingResult);

			chai.expect(parsingResult[0]).to.eql({
				startTime: 5000,
				endTime: 25000,
				content: "Would you like to get < coffee?",
				id: undefined,
				entities: [
					{
						offset: 0,
						length: 31,
						type: 1,
					},
				],
			});

			chai.expect(parsingResult[1]).to.eql({
				startTime: 0,
				endTime: 20000,
				content: "Hi, my name is Fred",
				id: undefined,
				entities: [
					{
						offset: 0,
						length: 19,
						attributes: ["en-US"],
					},
				],
			});
		});

		it("should return an array containing four cues when a timestamps are found", () => {
			const parsingResult = renderer.parse(TIMESTAMPS_CUES_CONTENT);
			chai.expect(parsingResult).to.be.an("array");
			chai.expect(parsingResult.length).to.eql(4);

			console.log(parsingResult);

			// chai.expect(parsingResult[0]).to.eql({
			// 	startTime: 5000,
			// 	endTime: 25000,
			// 	content: "Would you like to get < coffee?",
			// 	id: undefined,
			// 	entities: [
			// 		{
			// 			offset: 0,
			// 			length: 31,
			// 			type: 1,
			// 		},
			// 	],
			// });

			// chai.expect(parsingResult[1]).to.eql({
			// 	startTime: 0,
			// 	endTime: 20000,
			// 	content: "Hi, my name is Fred",
			// 	id: undefined,
			// 	entities: [
			// 		{
			// 			offset: 0,
			// 			length: 19,
			// 			attributes: ["en-US"],
			// 		},
			// 	],
			// });
		});
	});
});
