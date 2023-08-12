import * as ClockTime from "./ClockTime.js";
import * as Media from "./Media.js";
import * as SMPTE from "./SMPTE.js";

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

/**
 * All interfaces here are required, as
 * they should throw an error when used
 * if a format is not supported with a
 * specific `ttp:timeBase`.
 */

export interface TimeBaseProtocol {
	getMillisecondsByClockTime(): number;
	getMillisecondsByWallClockTime(): number;
	getMillisecondsByOffsetTime(): number;
}
