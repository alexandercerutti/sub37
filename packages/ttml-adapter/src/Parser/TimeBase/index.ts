import type { ClockTimeUnit } from "../TimeExpressions/matchers/clockTime";
import type { OffsetTimeUnit } from "../TimeExpressions/matchers/offsetTime";
import type { WallClockUnit } from "../TimeExpressions/matchers/wallclockTime";
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
			 * If not specified, the default time base must be considered to be media.
			 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#parameter-attribute-timeBase
			 */
			return Media;
		}
	}
}

export interface TimeDetails {
	"ttp:timeBase"?: "media" | "smpte" | "clock";
	"ttp:frameRate"?: number;
	"ttp:subFrameRate"?: number;
	"ttp:frameRateMultiplier"?: number;
	"ttp:tickRate"?: number;
	"ttp:dropMode"?: "dropNTSC" | "dropPAL" | "nonDrop";
	"ttp:markerMode"?: "continuous" | "discontinuous";
}

/**
 * All interfaces here are set to be required,
 * as, when used with a `ttp:timeBase` that
 * does not support them, they should throw
 * a meaningful error.
 */

interface TimeBaseProviderProtocol {
	readonly timeBaseNameSymbol: symbol;
	getMillisecondsByClockTime(
		match: ClockTimeUnit,
		timeDetails: TimeDetails,
		referenceBegin: number,
	): number;
	getMillisecondsByWallClockTime(match: WallClockUnit): number;
	getMillisecondsByOffsetTime(
		match: OffsetTimeUnit,
		timeDetails: TimeDetails,
		referenceBegin: number,
	): number;
}
