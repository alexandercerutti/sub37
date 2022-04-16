// @ts-check
import { describe, it, expect } from "@jest/globals";
import { parseCue, parseRegion } from "../lib/Parser/index.js";

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
			expect(
				parseCue({
					attributes: "region:fred align:left",
					cueid: undefined,
					starttime: "00:00:05.000",
					endtime: "00:00:25.000",
					text: "<v Fred&gt;>Would you like to get &lt; coffee?",
				}),
			).toEqual([
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
					attributes: {
						align: "left",
					},
				},
			]);
		});

		it("should return an array of CueNodes if a CueData inclues timestamps. All the CueNodes should maintain the same origin ID", () => {
			/** @type {import("../lib/Parser/index.js").CueRawData} */
			const originalData = {
				attributes: "",
				cueid: "text-1",
				starttime: "00:00:00.000",
				endtime: "00:00:27.000",
				text: `Welcome Liquicity Airlines
<00:00:06.000> Our destination: the galaxy of dreams
<00:00:09.000> (Our destination: the galaxy of dreams)
<00:00:12.000> Estimated Time of Arrival: unknown
<00:00:18.000> Please fasten your seatbelt
<00:00:21.000> And get ready to take off
<00:00:24.000> (Please fasten your seatbelt)
<00:00:27.000> (And get ready to take off)
`,
			};

			const parsingResult = parseCue(originalData);

			expect(parsingResult.length).toBe(8);

			expect(parsingResult[0]).toEqual({
				id: "text-1",
				startTime: 0,
				endTime: 27000,
				content: "Welcome Liquicity Airlines\n",
				entities: [],
				attributes: {},
			});

			expect(parsingResult[1]).toEqual({
				id: "text-1",
				startTime: 6000,
				endTime: 27000,
				content: " Our destination: the galaxy of dreams\n",
				entities: [],
			});

			expect(parsingResult[2]).toEqual({
				id: "text-1",
				startTime: 9000,
				endTime: 27000,
				content: " (Our destination: the galaxy of dreams)\n",
				entities: [],
			});

			expect(parsingResult[3]).toEqual({
				id: "text-1",
				startTime: 12000,
				endTime: 27000,
				content: " Estimated Time of Arrival: unknown\n",
				entities: [],
			});

			expect(parsingResult[4]).toEqual({
				id: "text-1",
				startTime: 18000,
				endTime: 27000,
				content: " Please fasten your seatbelt\n",
				entities: [],
			});

			expect(parsingResult[5]).toEqual({
				id: "text-1",
				startTime: 21000,
				endTime: 27000,
				content: " And get ready to take off\n",
				entities: [],
			});

			expect(parsingResult[6]).toEqual({
				id: "text-1",
				startTime: 24000,
				endTime: 27000,
				content: " (Please fasten your seatbelt)\n",
				entities: [],
			});

			expect(parsingResult[7]).toEqual({
				id: "text-1",
				startTime: 27000,
				endTime: 27000,
				content: " (And get ready to take off)\n",
				entities: [],
			});
		});

		it("should return an array of CueNodes with the same id and endTime if one cue is passed", () => {
			/** @type {import("../lib/Parser/index.js").CueRawData} */
			const originalData = {
				attributes: "",
				cueid: "text-1",
				starttime: "00:00:00.000",
				endtime: "00:00:16.000",
				text: `Welcome to the galaxy of dreams`,
			};

			const parsingResult = parseCue(originalData);

			expect(parsingResult.length).toBe(1);

			expect(parsingResult[0]).toEqual({
				id: "text-1",
				startTime: 0,
				endTime: 16000,
				content: "Welcome to the galaxy of dreams",
				entities: [],
				attributes: {},
			});
		});

		it("should return an array of CueNodes that have the same entities if an entity start before a timestamp and ends in a next timestamp", () => {
			/** @type {import("../lib/Parser/index.js").CueRawData} */
			const originalData = {
				attributes: "",
				cueid: "text-1",
				starttime: "00:00:00.000",
				endtime: "00:00:30.000",
				text: `<v Announcer>Welcome Liquicity Airlines
<00:00:06.000> Our destination: the galaxy of dreams
<00:00:09.000> (Our destination: the galaxy of dreams)</v>
<v Announcer2><00:00:12.000> Estimated Time of Arrival: unknown
<00:00:18.000> Please fasten your seatbelt</v>
<00:00:21.000> <v Announcer3>And get ready to take off
<00:00:24.000> (Please fasten your seatbelt)</v>
<00:00:27.000> (And get ready to take off)
`,
			};

			const parsingResult = parseCue(originalData);
			expect(parsingResult.length).toBe(8);

			expect(parsingResult[0].entities).toEqual([
				{
					offset: 0,
					length: 27,
					attributes: ["Announcer"],
					type: 1,
				},
			]);

			expect(parsingResult[1].entities).toEqual([
				{
					offset: 0,
					length: 39,
					attributes: ["Announcer"],
					type: 1,
				},
			]);

			expect(parsingResult[2].entities).toEqual([
				{
					offset: 0,
					length: 40,
					attributes: ["Announcer"],
					type: 1,
				},
			]);

			expect(parsingResult[3].entities).toEqual([
				{
					offset: 0,
					length: 36,
					attributes: ["Announcer2"],
					type: 1,
				},
			]);

			expect(parsingResult[4].entities).toEqual([
				{
					offset: 0,
					length: 28,
					attributes: ["Announcer2"],
					type: 1,
				},
			]);

			expect(parsingResult[5].entities).toEqual([
				{
					offset: 1,
					length: 26,
					attributes: ["Announcer3"],
					type: 1,
				},
			]);

			expect(parsingResult[7].entities).toEqual([]);
		});
	});

	describe("parseRegion", () => {
		const REGION_WITH_ATTRIBUTES_NEWLINES = `id:fred
width:40%
lines:3
regionanchor:0%,100%
viewportanchor:10%,90%
scroll:up
`;

		const REGION_WITH_ATTRIBUTES_SPACES = `id:fred width:40% lines:3 regionanchor:0%,100% viewportanchor:10%,90% scroll:up`;

		it("should return a custom region with converted attributes if string is separated by newlines", () => {
			expect(parseRegion(REGION_WITH_ATTRIBUTES_NEWLINES)).toEqual({
				id: "fred",
				width: "40%",
				lines: 3,
				displayStrategy: "push",
				origin: ["10%", "90%"],
			});
		});

		it("should return a custom region with converted attributes if string is separated by spaces", () => {
			expect(parseRegion(REGION_WITH_ATTRIBUTES_SPACES)).toEqual({
				id: "fred",
				width: "40%",
				lines: 3,
				displayStrategy: "push",
				origin: ["10%", "90%"],
			});
		});
	});
});
