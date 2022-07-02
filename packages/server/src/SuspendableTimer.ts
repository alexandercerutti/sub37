interface Ticker {
	run(): void;
}

function createTicker(tickCallback: () => void) {
	return {
		run() {
			tickCallback();
		},
	};
}

export class SuspendableTimer {
	private interval: number = null;
	private ticker: Ticker;

	constructor(private frequency: number, tickCallback: () => void) {
		this.ticker = createTicker(tickCallback);
	}

	public start() {
		if (this.isRunning) {
			return;
		}

		this.interval = window.setInterval(this.ticker.run, this.frequency);
	}

	public stop() {
		if (!this.isRunning) {
			return;
		}

		window.clearInterval(this.interval);
		this.interval = null;
	}

	public get isRunning() {
		return Boolean(this.interval);
	}

	/**
	 * Allows executing a function call of the timer
	 * (tick) without waiting for the timer.
	 *
	 * Most useful when the timer is suspended and the
	 * function is run "manually".
	 */

	public runTick() {
		this.ticker.run();
	}
}
