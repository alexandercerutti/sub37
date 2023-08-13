import * as ClockTime from "./ClockTime.js";
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

export function getTimeBaseProvider(timeBase: "smpte" | "media" | "clock"): TimeBaseProtocol {
	switch (timeBase) {
		case "clock": {
			return ClockTime;
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

export type ClockTimeMatch = [
	hours: number,
	minutes: number,
	seconds: number,
	fraction: number,
	frames: number,
	subframes: number,
];

export interface TimeDetails {
	"ttp:timeBase": "media" | "smpte" | "clock";
	"ttp:frameRate": number;
	"ttp:subFrameRate": number;
	"ttp:frameRateMultiplier": number;
	"ttp:tickRate": number;
	"ttp:dropMode"?: "dropNTSC" | "dropPAL";
}

/**
 * All interfaces here are required, as
 * they should throw an error when used
 * if a format is not supported with a
 * specific `ttp:timeBase`.
 */

export interface TimeBaseProtocol {
	getMillisecondsByClockTime(match: ClockTimeMatch, timeDetails: TimeDetails): number;
	getMillisecondsByWallClockTime(): number;
	getMillisecondsByOffsetTime(): number;
}
