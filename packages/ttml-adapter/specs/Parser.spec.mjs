import { describe, expect, it } from "@jest/globals";

describe("parseCue", () => {
	describe("regex time conversion", () => {
		// hours : minutes : seconds (. fraction | : frames ('.' sub-frames)? )?
		describe("Clock Time", () => {
			it.failing("Should not convert reject 'hh' and 'hh:mm'", () => {});

			it.failing("Should convert 'hh:mm:ss'", () => {
				// "22:57:10"
			});

			it.failing("Should convert 'hh:mm:ss.fraction'", () => {
				// 22:57:10.300
			});

			it.failing("Should convert 'hh:mm:ss:frames'", () => {
				// 22:57:10:8762231
			});

			it.failing("Should convert 'hh:mm:ss:frames.sub-frames'", () => {
				// 22:57:10:8762231.20
			});
		});

		describe("Offset time", () => {
			it.failing("Should convert 'time-count fraction? metric'", () => {
				// 10f, 10h
				// 10.500f
			});
		});

		/** "wallclock(" <lwsp>? ( date-time | wall-time | date ) <lwsp>? ")" */
		describe("Wallclock time", () => {
			it.failing("should convert 'wallclock(\"<lwsp>? (date-time) <lwsp>?\")'", () => {
				// wallclock(" YYYY-MM-DDTHH:MM:SS ")
				// wallclock(" YYYY-MM-DDTHH:MM ")
			});
			it.failing("should convert 'wallclock(\"<lwsp>? (wall-time) <lwsp>?\")'", () => {
				// wallclock(" HH:MM:SS ")
				// wallclock(" HH:MM ")
			});
			it.failing("should convert 'wallclock(\"<lwsp>? (date) <lwsp>?\")'", () => {
				// wallclock(" YYYY-MM-DD ")
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
});
