import { DebouncedOperation } from "./DebouncedOperation";

const LOCAL_STORAGE_KEY = "latest-track-text";
const schedulerOperation = Symbol("schedulerOperation");

export class TrackScheduler {
	private [schedulerOperation]: DebouncedOperation;

	constructor(private onCommit: (text: string) => void) {
		const latestTrack = localStorage.getItem(LOCAL_STORAGE_KEY);

		if (latestTrack) {
			this.commit(latestTrack);
		}
	}

	private set operation(fn: Function) {
		DebouncedOperation.clear(this[schedulerOperation]);
		this[schedulerOperation] = DebouncedOperation.create(fn);
	}

	public schedule(text: string) {
		this.operation = () => this.commit(text);
	}

	private commit(text: string): void {
		if (!text.length) {
			return;
		}

		this.onCommit(text);
		localStorage.setItem(LOCAL_STORAGE_KEY, text);
	}
}
