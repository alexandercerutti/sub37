// @ts-check

import { describe, expect, it } from "@jest/globals";
import { parseCue } from "../lib/Parser/parseCue.js";
import { matchClockTimeExpression } from "../lib/Parser/TimeExpressions/matchers/clockTime.js";
import { matchOffsetTimeExpression } from "../lib/Parser/TimeExpressions/matchers/offsetTime.js";
import { matchWallClockTimeExpression } from "../lib/Parser/TimeExpressions/matchers/wallclockTime.js";
import { createScope } from "../lib/Parser/Scope/Scope.js";
import { createTimeContext } from "../lib/Parser/Scope/TimeContext.js";
import { TokenType } from "../lib/Parser/Token.js";

describe("parseCue", () => {
	describe("regex time conversion", () => {
		// hours : minutes : seconds (. fraction | : frames ('.' sub-frames)? )?
		describe("Clock Time", () => {
			it("Should not convert 'hh' and 'hh:mm'", () => {
				expect(matchClockTimeExpression("10")).toBe(null);
				expect(matchClockTimeExpression("10:20")).toBe(null);
			});

			it("Should convert 'hh:mm:ss'", () => {
				expect(matchClockTimeExpression("22:57:10")).toEqual([22, 57, 10]);
			});

			it("Should convert 'hh:mm:ss.fraction'", () => {
				expect(matchClockTimeExpression("22:57:10.300")).toEqual([22, 57, 10.3]);
				expect(matchClockTimeExpression("22:57:10.033")).toEqual([22, 57, 10.033]);
			});

			it("Should convert 'hh:mm:ss:frames'", () => {
				expect(matchClockTimeExpression("22:57:10:8762231")).toEqual([22, 57, 10, 8762231]);
			});

			it("Should convert 'hh:mm:ss:frames.sub-frames'", () => {
				expect(matchClockTimeExpression("22:57:10:8762231.20")).toEqual([22, 57, 10, 8762231, 20]);
			});
		});

		describe("Offset time", () => {
			it("Should convert 'time-count fraction? metric'", () => {
				expect(matchOffsetTimeExpression("10f")).toEqual([10, 0, "f"]);
				expect(matchOffsetTimeExpression("10h")).toEqual([10, 0, "h"]);
				expect(matchOffsetTimeExpression("10.500f")).toEqual([10, 0.5, "f"]);
				expect(matchOffsetTimeExpression("10.050f")).toEqual([10, 0.05, "f"]);
			});
		});

		/** "wallclock(" <lwsp>? ( date-time | wall-time | date ) <lwsp>? ")" */
		describe("Wallclock time", () => {
			it("should convert 'wallclock(\"<lwsp>&quest; (date-time) <lwsp>&quest;\")'", () => {
				expect(matchWallClockTimeExpression(`wallclock(" 2020-05-10T22:10:57 ")`)).toEqual(
					new Date("2020-05-10T19:10:57.000Z"),
				);
				expect(matchWallClockTimeExpression(`wallclock(" 2021-06-10T22:10")`)).toEqual(
					new Date("2021-06-10T19:10:00.000Z"),
				);
			});

			it("should convert 'wallclock(\"<lwsp>&quest; (wall-time) <lwsp>&quest;\")'", () => {
				expect(matchWallClockTimeExpression(`wallclock("22:10:57 ")`)).toEqual(
					new Date("1970-01-01T21:10:57.000Z"),
				);
				expect(matchWallClockTimeExpression(`wallclock("22:10 ")`)).toEqual(
					new Date("1970-01-01T21:10:00.000Z"),
				);
			});

			it("should convert 'wallclock(\"<lwsp>&quest; (date) <lwsp>&quest;\")'", () => {
				expect(matchWallClockTimeExpression(`wallclock(" 2021-10-19 ")`)).toEqual(
					new Date(2021, 9, 19),
				);
			});
		});
	});

	describe("ttp:timeBase == 'clock'", () => {
		it.failing("should include only hours, minutes, seconds and fraction", () => {});
	});

	describe("ttp:timeBase == 'media'", () => {
		it.failing("should output a time that includes the previous one, if provided", () => {});

		it.failing(
			"should include frames, if provided with them, ttp:frameRate and ttp:frameRateMultiplier",
			() => {},
		);

		it.failing("should include subframes, if provided with them and ttp:subFrameRate", () => {});
	});

	describe("ttp:timeBase == 'smpte'", () => {
		it.failing(
			"should return a value based on frames, subframes, hours, minutes and seconds",
			() => {},
		);
	});

	it("should be coherent with anonymous span", () => {
		const Hello = {
			content: {
				content: "Hello",
				attributes: {},
				type: TokenType.STRING,
			},
			children: [],
		};

		const Guten = {
			content: {
				content: "Guten ",
				attributes: {},
				type: TokenType.STRING,
			},
			children: [],
		};

		const Tag = {
			content: {
				content: "Tag",
				attributes: {},
				type: TokenType.STRING,
			},
			children: [],
		};

		const NamedSpan1 = {
			content: {
				content: "span",
				attributes: {},
				type: TokenType.START_TAG,
			},
			children: [
				Guten,
				{
					content: {
						content: "span",
						attributes: {},
						type: TokenType.START_TAG,
					},
					children: [Tag],
				},
			],
		};

		const Allo = {
			content: {
				content: "Allo",
				attributes: {},
				type: TokenType.STRING,
			},
			children: [],
		};

		const Paragraph = {
			content: {
				content: "p",
				attributes: {
					timeContainer: "seq",
					"xml:id": "par-01",
				},
				type: TokenType.START_TAG,
			},
			children: [Hello, NamedSpan1, Allo],
		};

		Hello.parent = Paragraph;
		Allo.parent = Paragraph;
		NamedSpan1.parent = Paragraph;
		Guten.parent = NamedSpan1;
		Tag.parent = NamedSpan1.children[0];

		const parsed = parseCue(Paragraph, createScope(undefined), {});

		expect(parsed).toBeInstanceOf(Array);
		expect(parsed.length).toBe(4);
		expect(parsed[0]).toMatchObject({
			content: "Hello",
			startTime: 0,
			endTime: 0,
		});
		expect(parsed[1]).toMatchObject({
			content: "Guten ",
			startTime: 0,
			endTime: Infinity,
		});
		expect(parsed[2]).toMatchObject({
			content: "Tag",
			startTime: 0,
			endTime: Infinity,
		});
		expect(parsed[3]).toMatchObject({
			content: "Allo",
			startTime: 0,
			endTime: 0,
		});
	});

	it("should be return timestamps", () => {
		const Paragraph1 = {
			content: {
				content: "p",
				attributes: {
					"xml:id": "par-01",
				},
				type: TokenType.START_TAG,
			},
			children: [
				{
					content: {
						type: TokenType.START_TAG,
						content: "span",
						attributes: {
							begin: "0s",
						},
					},
					children: [
						{
							content: {
								type: TokenType.STRING,
								content: "Lorem",
								attributes: {},
							},
							children: [],
						},
					],
				},
				{
					content: {
						type: TokenType.START_TAG,
						content: "span",
						attributes: {
							begin: "1s",
						},
					},
					children: [
						{
							content: {
								type: TokenType.STRING,
								content: "ipsum",
								attributes: {},
							},
							children: [],
						},
					],
				},
				{
					content: {
						type: TokenType.START_TAG,
						content: "span",
						attributes: {
							begin: "2s",
						},
					},
					children: [
						{
							content: {
								type: TokenType.STRING,
								content: "dolor",
								attributes: {},
							},
							children: [],
						},
					],
				},
				{
					content: {
						type: TokenType.START_TAG,
						content: "span",
						attributes: {
							begin: "3s",
						},
					},
					children: [
						{
							content: {
								type: TokenType.STRING,
								content: "sit",
								attributes: {},
							},
							children: [],
						},
					],
				},
			],
		};

		const parsed = parseCue(
			Paragraph1,
			createScope(
				undefined,
				createTimeContext({
					begin: 0,
					end: 25000,
				}),
			),
			{},
		);

		expect(parsed).toBeInstanceOf(Array);
		expect(parsed.length).toBe(4);
		expect(parsed[0]).toMatchObject({
			content: "Lorem",
			startTime: 0,
			endTime: 25000,
		});
		expect(parsed[1]).toMatchObject({
			content: "ipsum",
			startTime: 1000,
			endTime: 25000,
		});
		expect(parsed[2]).toMatchObject({
			content: "dolor",
			startTime: 2000,
			endTime: 25000,
		});
		expect(parsed[3]).toMatchObject({
			content: "sit",
			startTime: 3000,
			endTime: 25000,
		});
	});
});
