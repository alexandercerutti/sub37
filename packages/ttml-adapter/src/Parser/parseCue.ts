import { getTimeBaseProvider } from "./TimeBase/index.js";
import { matchClockTimeExpression } from "./TimeExpressions/clockTime.js";
import { matchOffsetTimeExpression } from "./TimeExpressions/offsetTime.js";
import { matchWallClockTimeExpression } from "./TimeExpressions/wallclockTime.js";

interface TimeDetails {
	"ttp:timeBase": "media" | "smpte" | "clock";
	"ttp:frameRate": number;
	"ttp:subFrameRate": number;
	"ttp:frameRateMultiplier": number;
	"ttp:tickRate": number;
	"ttp:dropMode": "dropNTSC" | "dropPAL";
}

function parseTimeString(timeString: string, timeDetails: TimeDetails): number {
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
