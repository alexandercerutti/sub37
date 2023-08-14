import type { ClockTimeMatch } from "../TimeExpressions/clockTime";
import type { OffsetTimeMatch } from "../TimeExpressions/offsetTime";
import type { WallClockMatch } from "../TimeExpressions/wallclockTime";
import * as Clock from "./Clock.js";
import * as Media from "./Media.js";
import * as SMPTE from "./SMPTE.js";

/**
 * Selects the TimeBase provider.
 * Development note: typescript will prompt
 * error if any of the providers won't honor
 * the protocol.
 *
 * @param timeBase
 * @returns
 */

export function getTimeBaseProvider(
	timeBase: "smpte" | "media" | "clock",
): TimeBaseProviderProtocol {
	switch (timeBase) {
		case "clock": {
			return Clock;
		}

		case "media": {
			return Media;
		}

		case "smpte": {
			return SMPTE;
		}

		default: {
			/**
			 * @TODO Transform in a better error
			 */

			throw new Error(`Provider not found for timeBase '${timeBase}'.`);
		}
	}
}

export interface TimeDetails {
	"ttp:timeBase": "media" | "smpte" | "clock";
	"ttp:frameRate": number;
	"ttp:subFrameRate": number;
	"ttp:frameRateMultiplier": number;
	"ttp:tickRate": number;
	"ttp:dropMode"?: "dropNTSC" | "dropPAL";
}

/**
 * All interfaces here are set to be required,
 * as, when used with a `ttp:timeBase` that
 * does not support them, they should throw
 * a meaningful error.
 */

interface TimeBaseProviderProtocol {
	getMillisecondsByClockTime(match: ClockTimeMatch, timeDetails: TimeDetails): number;
	getMillisecondsByWallClockTime(match: WallClockMatch): number;
	getMillisecondsByOffsetTime(match: OffsetTimeMatch, timeDetails: TimeDetails): number;
}
