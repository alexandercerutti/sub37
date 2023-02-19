export class DebouncedOperation {
	private timer: number;

	private constructor(timer: number) {
		this.timer = timer;
	}

	public static clear(operation: DebouncedOperation) {
		if (operation) {
			window.clearTimeout(operation.timer);
		}
	}

	public static create(fn: Function) {
		return new DebouncedOperation(window.setTimeout(fn, 1500));
	}
}
