import { HSBaseRendererConstructor } from "@hsubs/base-renderer";
import { RawTrack } from "./model";
import { HSSession } from "./Session";

const intervalSymbol /********/ = Symbol("hs.s.interval");
const latestIndexSymbol /*****/ = Symbol("hs.s.index");
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
	private [renderersSymbol]: HSBaseRendererConstructor<unknown>[];
	private [sessionSymbol]: HSSession<unknown> = null;

	constructor(...renderers: HSBaseRendererConstructor<unknown>[]) {
		this[renderersSymbol] = renderers.filter((Renderer) => Renderer.supportedType);
	}

	/**
	 * Creates a new subtitles / captions
	 * distribution session.
	 *
	 * @param content
	 * @param mimeType
	 * @returns
	 */

	public startSession<C>(
		rawTracks: RawTrack<C>[],
		mimeType: `${"application" | "text"}/${string}`,
	) {
		this[sessionSymbol] = null;

		const Renderer: HSBaseRendererConstructor<C> = this[renderersSymbol].find(
			(Renderer) => Renderer.supportedType === mimeType,
		);

		if (!Renderer) {
			console.warn(
				`No renderer supports this content type (${mimeType}}. Engine won't render anything.`,
			);

			return;
		}

		this[sessionSymbol] = new HSSession<C>(rawTracks, new Renderer());
	}

	/**
	 * Allows starting the server.
	 * It will start sending events through the listeners.
	 *
	 * Throws if no session have been started.
	 *
	 * Throws if frequency is explicitly set to a _falsy_ value
	 * or to a value which is not a number.
	 *
	 * @param getCurrentPosition
	 * @param frequencyMs - defaults to 250ms
	 * @returns
	 */

	public start(getCurrentPosition: () => number, frequencyMs: number = 250) {
		if (!this[sessionSymbol]) {
			throw new Error("No session started. Engine won't serve any subtitles.");
		}

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
		// 	if (lang === null) {
		// 		this.stop();
		// 		return;
		// 	}
		// 	if (this[selectedSourceSymbol] && lang === this[selectedSourceSymbol].lang) {
		// 		return;
		// 	}
		// 	const currentSource = this[selectedSourceSymbol];
		// 	for (let source of this[sourcesSymbol]) {
		// 		if (lang === source.lang) {
		// 			this[selectedSourceSymbol] = source;
		// 			break;
		// 		}
		// 	}
		// 	if (this[selectedSourceSymbol] === currentSource) {
		// 		throw new Error("Unable to set language: not found.");
		// 	}
	}
}
