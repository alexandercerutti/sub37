// @ts-check
import { parseCue } from "../lib/Parser/index.js";

describe("Parser", () => {
	describe("parseCue", () => {
		const TEST_CONTENT = `
WEBVTT

00:00:05.000 --> 00:00:25.000 region:fred align:left
<v Fred&gt;>Would you like to get &lt; coffee?

00:00:00.000 --> 00:00:20.000 region:fred align:left
<lang.mimmo en-US>Hi, my name is Fred</lang>

00:00:16.000 --> 00:00:24.000
<00:00:16.000> <c.mimmo>This</c>
<00:00:18.000> <c>can</c>
<00:00:20.000> <c>match</c>
<00:00:22.000> <c>:past/:future</c>
<00:00:24.000>
`;

		it("should convert a CueData to a CueNode", () => {
			chai
				.expect(
					parseCue({
						attributes: "region:fred align:left",
						cueid: undefined,
						starttime: "00:00:05.000",
						endtime: "00:00:25.000",
						text: "<v Fred&gt;>Would you like to get &lt; coffee?",
					}),
				)
				.to.eql([
					{
						id: undefined,
						startTime: 5000,
						endTime: 25000,
						content: "Would you like to get < coffee?",
						entities: [
							{
								offset: 0,
								length: 31,
								attributes: ["Fred>"],
								type: 1,
							},
						],
					},
				]);
		});

		it("should return an array of CueNode if a CueData inclues timestamps. All the CueNodes should maintain the same origin ID", () => {
			/** @type {import("../lib/Parser/index.js").CueData} */
			const originalData = {
				attributes: "",
				cueid: "text-1",
				starttime: "00:00:00.000",
				endtime: "00:00:16.000",
				text: `Welcome to the galaxy of dreams
<00:00:04.000> Estimated Time of Arrival:
<00:00:06.000> Unknown
<00:00:08.000> Please take your seat back
<00:00:10.000> And get ready to take off
<00:00:12.000> (Please take your seat back)
<00:00:14.000> (And get ready to take off)
`,
			};

			const parsingResult = parseCue(originalData);

			chai.expect(parsingResult.length).to.equal(7);

			chai.expect(parsingResult[0]).to.eql({
				id: "text-1",
				startTime: 0,
				endTime: 16000,
				content: "Welcome to the galaxy of dreams\n",
				entities: [],
			});

			chai.expect(parsingResult[1]).to.eql({
				id: "text-1",
				startTime: 4000,
				endTime: 16000,
				content: " Estimated Time of Arrival:\n",
				entities: [],
			});

			chai.expect(parsingResult[2]).to.eql({
				id: "text-1",
				startTime: 6000,
				endTime: 16000,
				content: " Unknown\n",
				entities: [],
			});

			chai.expect(parsingResult[3]).to.eql({
				id: "text-1",
				startTime: 8000,
				endTime: 16000,
				content: " Please take your seat back\n",
				entities: [],
			});

			chai.expect(parsingResult[4]).to.eql({
				id: "text-1",
				startTime: 10000,
				endTime: 16000,
				content: " And get ready to take off\n",
				entities: [],
			});

			chai.expect(parsingResult[5]).to.eql({
				id: "text-1",
				startTime: 12000,
				endTime: 16000,
				content: " (Please take your seat back)\n",
				entities: [],
			});

			chai.expect(parsingResult[6]).to.eql({
				id: "text-1",
				startTime: 14000,
				endTime: 16000,
				content: " (And get ready to take off)\n",
				entities: [],
			});
		});

		it("should return an array of CueNode with the same id and endTime if one cue is passed", () => {
			/** @type {import("../lib/Parser/index.js").CueData} */
			const originalData = {
				attributes: "",
				cueid: "text-1",
				starttime: "00:00:00.000",
				endtime: "00:00:16.000",
				text: `Welcome to the galaxy of dreams`,
			};

			const parsingResult = parseCue(originalData);

			chai.expect(parsingResult.length).to.equal(1);

			chai.expect(parsingResult[0]).to.eql({
				id: "text-1",
				startTime: 0,
				endTime: 16000,
				content: "Welcome to the galaxy of dreams",
				entities: [],
			});
		});
	});
});
