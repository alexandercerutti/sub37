type Events = "timeupdate" | "playing" | "pause" | "seeked";

const currentTimeSymbol = Symbol("currentTime");
const durationSymbol = Symbol("duration");

export class FakeHTMLVideoElement {
	private listeners: { [key in Events]: Function[] } = Object.create(null);
	private [currentTimeSymbol]: number = 0;
	private [durationSymbol]: number = 0;
	private playheadInterval: number | undefined;

	constructor(duration: number) {
		this.duration = duration;
	}

	public get currentTime(): number {
		return this[currentTimeSymbol];
	}

	public set currentTime(value: number) {
		this[currentTimeSymbol] = Math.min(Math.max(0, value), this[durationSymbol]);
		this.emitEvent("seeked", value);
		this.emitEvent("timeupdate", value);
	}

	public get duration(): number {
		return this[durationSymbol];
	}

	public set duration(value: number) {
		this[durationSymbol] = value;
	}

	public get paused() {
		return this.playheadInterval === undefined;
	}

	public addEventListener(event: Events, listener: Function) {
		(this.listeners[event] ??= []).push(listener);
	}

	public removeEventListener(event: Events, listener: Function) {
		const index = (this.listeners[event] ??= []).findIndex((e) => e === listener);

		if (index === -1) {
			return;
		}

		this.listeners[event].splice(index, 1);
	}

	private emitEvent(event: Events, data?: unknown) {
		const handlers = this.listeners[event] ?? [];

		for (let h of handlers) {
			h(data);
		}
	}

	public play() {
		this.playheadInterval = window.setInterval(() => {
			this.emitEvent("timeupdate", this[currentTimeSymbol]);
			this[currentTimeSymbol] += 0.25;

			if (this[currentTimeSymbol] >= this.duration) {
				this.pause();
			}
		}, 250);
		this.emitEvent("playing");
	}

	public pause() {
		if (this.paused) {
			return;
		}

		window.clearInterval(this.playheadInterval);
		this.playheadInterval = undefined;
		this.emitEvent("pause");
	}
}
