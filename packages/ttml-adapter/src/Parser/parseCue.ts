import type { TimeDetails } from "./TimeBase";
import { getTimeBaseProvider } from "./TimeBase/index.js";
import { matchClockTimeExpression } from "./TimeExpressions/matchers/clockTime.js";
import { matchOffsetTimeExpression } from "./TimeExpressions/matchers/offsetTime.js";
import { matchWallClockTimeExpression } from "./TimeExpressions/matchers/wallclockTime.js";

export function parseTimeString(timeString: string, timeDetails: TimeDetails): number {
	const timeProvider = getTimeBaseProvider(timeDetails["ttp:timeBase"]);

	{
		const match = matchClockTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByClockTime(match, timeDetails);
		}
	}

	{
		const match = matchOffsetTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByOffsetTime(match, timeDetails);
		}
	}

	{
		const match = matchWallClockTimeExpression(timeString);

		if (match) {
			return timeProvider.getMillisecondsByWallClockTime(match);
		}
	}

	/**
	 * @TODO improve error type here
	 */

	throw new Error(
		"Time format didn't match any supported format (ClockTime, OffsetTime or WallClock);",
	);
}
