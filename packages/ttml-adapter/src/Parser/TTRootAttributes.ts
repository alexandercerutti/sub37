import type { TimeDetails } from "./TimeBase";

export function parseDocumentSupportedAttributes(
	attributes: Record<string, string>,
): Readonly<TimeDetails> {
	const frameRate = getFrameRateResolvedValue(attributes["ttp:frameRate"]);
	const subFrameRate = getFrameRateResolvedValue(attributes["ttp:subFrameRate"]);
	const tickRate = getTickRateResolvedValue(attributes["ttp:tickRate"], frameRate, subFrameRate);

	return Object.freeze({
		"ttp:dropMode": getDropModeResolvedValue(attributes["ttp:dropMode"]),
		"ttp:frameRate": frameRate || 30,
		"ttp:subFrameRate": subFrameRate || 1,
		"ttp:frameRateMultiplier": getFrameRateMultiplerResolvedValue(
			attributes["ttp:frameRateMultiplier"],
		),
		"ttp:tickRate": tickRate,
		"ttp:timeBase": getTimeBaseResolvedValue(attributes["ttp:timeBase"]),
	} satisfies TimeDetails);
}

function getDropModeResolvedValue(dropMode: string): TimeDetails["ttp:dropMode"] {
	const dropModes: ReadonlyArray<TimeDetails["ttp:dropMode"]> = ["dropNTSC", "dropPAL", "nonDrop"];

	return dropModes.find((e) => e === dropMode) ?? "nonDrop";
}

function getFrameRateResolvedValue(frameRate: string): TimeDetails["ttp:frameRate"] | undefined {
	const parsed = parseFloat(frameRate);

	if (Number.isNaN(parsed) || parsed <= 0) {
		return undefined;
	}

	return parsed;
}

function getFrameRateMultiplerResolvedValue(
	frameRateMultiplier: string | undefined,
): TimeDetails["ttp:frameRateMultiplier"] {
	if (!frameRateMultiplier) {
		return 1;
	}

	const parsed = frameRateMultiplier.split("\x20").map((e) => parseFloat(e));

	if (parsed.length < 2) {
		return 1;
	}

	const [numerator, denominator] = parsed;

	if (Number.isNaN(numerator)) {
		return 1;
	}

	if (Number.isNaN(denominator)) {
		/** Like `parsed[0] / 1` **/
		return numerator;
	}

	return numerator / denominator;
}

function getTickRateResolvedValue(
	tickRate: string,
	frameRate: number,
	subFrameRate: number,
): TimeDetails["ttp:tickRate"] {
	if (!tickRate) {
		return (frameRate ?? 0) * (subFrameRate ?? 1) || 1;
	}

	return parseFloat(tickRate);
}

function getTimeBaseResolvedValue(timeBase: string): TimeDetails["ttp:timeBase"] {
	const dropModes: ReadonlyArray<TimeDetails["ttp:timeBase"]> = ["media", "clock", "smpte"];

	return dropModes.find((e) => e === timeBase) ?? "media";
}
