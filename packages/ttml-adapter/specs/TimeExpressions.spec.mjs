import { describe, expect, it } from "@jest/globals";
import { matchClockTimeExpression } from "../lib/Parser/TimeExpressions/matchers/clockTime.js";
import { matchOffsetTimeExpression } from "../lib/Parser/TimeExpressions/matchers/offsetTime.js";
import { matchWallClockTimeExpression } from "../lib/Parser/TimeExpressions/matchers/wallclockTime.js";

// hours : minutes : seconds (. fraction | : frames ('.' sub-frames)? )?
describe("Clock Time conversion to time matcher", () => {
	it("Should not convert 'hh' and 'hh:mm'", () => {
		expect(matchClockTimeExpression("10")).toBe(null);
		expect(matchClockTimeExpression("10:20")).toBe(null);
	});

	it("Should convert 'hh:mm:ss'", () => {
		const [hoursUnit1, minutesUnit1, secondsUnit1] = matchClockTimeExpression("22:57:10");

		expect(hoursUnit1).toMatchObject({ value: 22, metric: "hours" });
		expect(minutesUnit1).toMatchObject({ value: 57, metric: "minutes" });
		expect(secondsUnit1).toMatchObject({ value: 10, metric: "seconds" });
	});

	it("Should convert 'hh:mm:ss.fraction'", () => {
		const [hoursUnit1, minutesUnit1, secondsUnit1] = matchClockTimeExpression("22:57:10.300");

		expect(hoursUnit1).toMatchObject({
			value: 22,
			metric: "hours",
		});
		expect(minutesUnit1).toMatchObject({
			value: 57,
			metric: "minutes",
		});
		expect(secondsUnit1).toMatchObject({
			value: 10.3,
			metric: "seconds",
		});

		const [hoursUnit2, minutesUnit2, secondsUnit2] = matchClockTimeExpression("22:57:10.033");

		expect(hoursUnit2).toMatchObject({
			value: 22,
			metric: "hours",
		});
		expect(minutesUnit2).toMatchObject({
			value: 57,
			metric: "minutes",
		});
		expect(secondsUnit2).toMatchObject({
			value: 10.033,
			metric: "seconds",
		});
	});

	it("Should convert 'hh:mm:ss:frames'", () => {
		const [hoursUnit, minutesUnit, secondsUnit, framesUnit] =
			matchClockTimeExpression("22:57:10:8762231.20");

		expect(hoursUnit).toMatchObject({
			value: 22,
			metric: "hours",
		});
		expect(minutesUnit).toMatchObject({
			value: 57,
			metric: "minutes",
		});
		expect(secondsUnit).toMatchObject({
			value: 10,
			metric: "seconds",
		});
		expect(framesUnit).toMatchObject({
			value: 8762231,
			metric: "frames",
		});
	});

	it("Should convert 'hh:mm:ss:frames.sub-frames'", () => {
		const [hoursUnit, minutesUnit, secondsUnit, framesUnit, subFramesUnit] =
			matchClockTimeExpression("22:57:10:8762231.20");

		expect(hoursUnit).toMatchObject({
			value: 22,
			metric: "hours",
		});
		expect(minutesUnit).toMatchObject({
			value: 57,
			metric: "minutes",
		});
		expect(secondsUnit).toMatchObject({
			value: 10,
			metric: "seconds",
		});
		expect(framesUnit).toMatchObject({
			value: 8762231,
			metric: "frames",
		});
		expect(subFramesUnit).toMatchObject({
			value: 0.2,
			metric: "subframes",
		});
	});
});

/** time-count fraction? metric */
describe("Offset time conversion to time matcher", () => {
	it("Should convert 'time-count fraction? metric'", () => {
		expect(matchOffsetTimeExpression("10f")).toMatchObject({ value: 10.0, metric: "f" });
		expect(matchOffsetTimeExpression("10h")).toMatchObject({ value: 10.0, metric: "h" });
		expect(matchOffsetTimeExpression("10.500f")).toMatchObject({ value: 10.5, metric: "f" });
		expect(matchOffsetTimeExpression("10.050f")).toMatchObject({ value: 10.05, metric: "f" });
	});
});

/** "wallclock(" <lwsp>? ( date-time | wall-time | date ) <lwsp>? ")" */
describe("Wallclock time conversion to time matcher", () => {
	it("should convert 'wallclock(\"<lwsp>&quest; (date-time) <lwsp>&quest;\")'", () => {
		expect(matchWallClockTimeExpression(`wallclock(" 2020-05-10T22:10:57 ")`)).toMatchObject({
			value: new Date("2020-05-10T19:10:57.000Z").getTime(),
			metric: "date",
		});

		expect(matchWallClockTimeExpression(`wallclock(" 2021-06-10T22:10")`)).toMatchObject({
			value: new Date("2021-06-10T19:10:00.000Z").getTime(),
			metric: "date",
		});
	});

	it("should convert 'wallclock(\"<lwsp>&quest; (wall-time) <lwsp>&quest;\")'", () => {
		expect(matchWallClockTimeExpression(`wallclock("22:10:57 ")`)).toMatchObject({
			value: new Date("1970-01-01T21:10:57.000Z").getTime(),
			metric: "date",
		});

		expect(matchWallClockTimeExpression(`wallclock("22:10 ")`)).toMatchObject({
			value: new Date("1970-01-01T21:10:00.000Z").getTime(),
			metric: "date",
		});
	});

	it("should convert 'wallclock(\"<lwsp>&quest; (date) <lwsp>&quest;\")'", () => {
		expect(matchWallClockTimeExpression(`wallclock(" 2021-10-19 ")`)).toMatchObject({
			value: new Date(2021, 9, 19).getTime(),
			metric: "date",
		});
	});
});
