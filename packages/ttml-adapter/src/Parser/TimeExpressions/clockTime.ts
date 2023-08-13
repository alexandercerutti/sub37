export type ClockTimeMatch = [
	hours: number,
	minutes: number,
	seconds: number,
	fraction: number,
	frames: number,
	subframes: number,
];

export function toClockTimeMatch(match: RegExpMatchArray): ClockTimeMatch {
	const [, hours, minutes, seconds, fraction, frames, subframes] = match;

	return [
		parseInt(hours),
		parseInt(minutes),
		parseInt(seconds),
		parseInt(fraction),
		parseInt(frames),
		parseInt(subframes),
	];
}
