export class SuspendableTimer {
	private interval: number = null;

	constructor(private frequency: number, private taskCallback: () => void) {}

	public start() {
		if (this.isRunning) {
			return;
		}

		this.interval = window.setInterval(this.taskCallback, this.frequency);
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
}
