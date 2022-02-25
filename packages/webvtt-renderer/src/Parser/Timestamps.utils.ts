const TIME_REGEX =
	/(?<hours>(\d{2})?):?(?<minutes>(\d{2})):(?<seconds>(\d{2}))(?:\.(?<milliseconds>(\d{0,3})))?/;

export function parseMs(timestring: string) {
	const timeMatch = timestring.match(TIME_REGEX);

	if (!timeMatch) {
		throw new Error("Time format is not valid. Ignoring cue.");
	}

	const {
		groups: { hours, minutes, seconds, milliseconds },
	} = timeMatch;

	const hoursInSeconds = parseIntFallback(hours) * 60 * 60;
	const minutesInSeconds = parseIntFallback(minutes) * 60;
	const parsedSeconds = parseIntFallback(seconds);
	const parsedMs = parseIntFallback(milliseconds) / 1000;

	return (hoursInSeconds + minutesInSeconds + parsedSeconds + parsedMs) * 1000;
}

function parseIntFallback(string: string) {
	return parseInt(string) || 0;
}
