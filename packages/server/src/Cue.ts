export class Cue {
	public id: string;
	public startTime: string;
	public endTime: string;

	constructor(public rawCueText: string, public entities: any[]) {}
}
