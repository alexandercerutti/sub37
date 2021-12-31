import type { HSBaseRenderer } from "@hsubs/base-renderer";

const intervalSymbol /********/ = Symbol("hs.s.interval");
const sourcesSymbol /*********/ = Symbol("hs.s.source");
const latestIndexSymbol /*****/ = Symbol("hs.s.index");
const selectedSourceSymbol /**/ = Symbol("hs.s.langselected");
const createIntervalSymbol /**/ = Symbol("hs.s.createInterval");
const renderersSymbol /*******/ = Symbol("hs.s.renderers");
const sessionSymbol /*********/ = Symbol("hs.s.session");

export class HSServer {
	private [intervalSymbol]: [
		interval: number,
		getCurrentPosition: () => number,
		frequencyMs: number,
	];
	private [latestIndexSymbol]: number;
	private [renderersSymbol]: typeof HSBaseRenderer[];
	private [sessionSymbol]: HSSession<unknown>;

	constructor(...renderers: typeof HSBaseRenderer[]) {
		this[renderersSymbol] = renderers.filter((Renderer) => Renderer.supportedType);
	}

	public startSession(content: unknown, mimeType: `${"application" | "text"}/${string}`) {
		let selectedRenderer: HSBaseRenderer = this[renderersSymbol].find(
			(Renderer) => Renderer.supportedType === mimeType,
		);

		if (!selectedRenderer) {
			console.warn(
				`No renderer supports this content type (${mimeType}}. Engine won't render anything.`,
			);

			return;
		}

		this[sessionSymbol] = new HSSession(content, selectedRenderer);
	}

	/**
	 * Allows starting the server.
	 * It will start sending events through the listeners.
	 *
	 * Throws if frequency is explicitly set to a _falsy_ value
	 * or to a value which is not a number.
	 *
	 * @param getCurrentPosition
	 * @param frequencyMs - defaults to 250ms
	 * @returns
	 */

	public start(getCurrentPosition: () => number, frequencyMs: number = 250) {
		if (!frequencyMs || typeof frequencyMs !== "number") {
			throw new Error(
				"Cannot start subtitles server: a frequency is required to be either be set to a value > 0 or not be set (fallback to 250ms)",
			);
		}

		if (this[intervalSymbol]?.[0]) {
			return;
		}

		this[intervalSymbol] = [
			this[createIntervalSymbol](getCurrentPosition, frequencyMs),
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

		const [, getCurrentPosition, frequencyMs] = this[intervalSymbol];

		this[intervalSymbol][0] = this[createIntervalSymbol](getCurrentPosition, frequencyMs);
	}

	/**
	 * Halts the serving activity by removing anything
	 * about the current activity.
	 */

	public stop() {
		window.clearInterval(this[intervalSymbol][0]);
		this[intervalSymbol] = undefined;
	}

	private [createIntervalSymbol](getCurrentPosition: () => number, frequencyMs: number) {
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

class HSSession<T> {
	constructor(private content: T, public renderer: HSBaseRenderer) {}
}
