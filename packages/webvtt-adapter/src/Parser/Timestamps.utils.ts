const TIME_REGEX =
	/(?<hours>(\d{2})?):?(?<minutes>(\d{2})):(?<seconds>(\d{2}))(?:\.(?<milliseconds>(\d{0,3})))?/;

export function parseMs(timestring: string): number {
	const timeMatch = timestring.match(TIME_REGEX);

	if (!timeMatch) {
		throw new Error("Time format is not valid. Ignoring cue.");
	}

	const {
		groups: { hours, minutes, seconds, milliseconds },
	} = timeMatch;

	const hoursInSeconds = zeroFallback(parseInt(hours)) * 60 * 60;
	const minutesInSeconds = zeroFallback(parseInt(minutes)) * 60;
	const parsedSeconds = zeroFallback(parseInt(seconds));
	const parsedMs = zeroFallback(parseInt(milliseconds)) / 1000;

	return (hoursInSeconds + minutesInSeconds + parsedSeconds + parsedMs) * 1000;
}

function zeroFallback(value: number): number {
	return value || 0;
}
