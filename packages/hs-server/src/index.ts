const intervalSymbol /********/ = Symbol("hs.s.interval");
const sourcesSymbol /*********/ = Symbol("hs.s.source");
const latestIndexSymbol /*****/ = Symbol("hs.s.index");
const selectedSourceSymbol /**/ = Symbol("hs.s.langselected");
const createIntervalSymbol /**/ = Symbol("hs.s.createInterval");

interface HSSource {
	lang: string;
	provider: any /** @TODO **/;
}

export class HSServer {
	private [intervalSymbol]: [
		interval: number,
		getCurrentPosition: () => number,
		frequencyMs: number,
	];
	private [sourcesSymbol]: HSSource[];
	private [selectedSourceSymbol]: HSSource;
	private [latestIndexSymbol]: number;

	constructor(sources: HSSource[]) {
		this[sourcesSymbol] = sources;
	}

	/**
	 * Allows starting the server.
	 * It will start sending events through the listeners
	 *
	 * @param getCurrentPosition
	 * @param frequencyMs
	 * @returns
	 */

	public start(getCurrentPosition: () => number, frequencyMs: number = 250) {
		if (this[intervalSymbol]?.[0]) {
			return;
		}

		this[intervalSymbol] = [
			this[createIntervalSymbol](frequencyMs),
			getCurrentPosition,
			frequencyMs,
		];
	}

	/**
	 * Suspends serving action without losing
	 * frequency and `getCurrentPosition` reference.
	 *
	 * @returns
	 */

	public suspend() {
		if (this[intervalSymbol]?.[0] === undefined) {
			// Nothing to suspend
			return;
		}

		window.clearInterval(this[intervalSymbol][0]);
		this[intervalSymbol][0] = undefined;
	}

	/**
	 * Resumes serving activity by using the previously
	 * provided frequency and `getCurrentPosition`.
	 *
	 * @returns
	 */

	public resume() {
		if (!this[intervalSymbol] || (this[intervalSymbol] && this[intervalSymbol][0] !== undefined)) {
			// Nothing to resume
			return;
		}

		this[intervalSymbol][0] = this[createIntervalSymbol](this[intervalSymbol][2]);
	}

	/**
	 * Halts the serving activity by removing anything
	 * about the current activity.
	 */

	public stop() {
		window.clearInterval(this[intervalSymbol][0]);
		this[intervalSymbol] = undefined;
	}

	private [createIntervalSymbol](frequencyMs: number) {
		return window.setInterval(() => {
			/**
			 * @TODO query the [selectedSourceSymbol] and request the next subtitle.
			 * This might be structured upon iterators. [selectedSourceSymbol] will
			 * accept the value of [latestIndexSymbol] as parameter so server
			 * will be the only one to be stateful.
			 *
			 * @TODO Setup listeners and set sending events to the functions.
			 */
		}, frequencyMs);
	}

	/**
	 * Provided a language to select, it attempts to switch to
	 * that language among the ones provided in the constructor.
	 *
	 * If language is a _falsy_ value, the server gets stopped.
	 *
	 * @param lang
	 * @returns
	 */

	public selectTextTrack(lang: string | null) {
		if (lang === null) {
			this.stop();
			return;
		}

		if (this[selectedSourceSymbol] && lang === this[selectedSourceSymbol].lang) {
			return;
		}

		const currentSource = this[selectedSourceSymbol];

		for (let source of this[sourcesSymbol]) {
			if (lang === source.lang) {
				this[selectedSourceSymbol] = source;
				break;
			}
		}

		if (this[selectedSourceSymbol] === currentSource) {
			throw new Error("Unable to set language: not found.");
		}
	}
}
