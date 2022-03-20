import { HSBaseRenderer, HSBaseRendererConstructor } from "./BaseRenderer";
import { RawTrack } from "./model";
import { HSSession } from "./Session.js";
import { SuspendableTimer } from "./SuspendableTimer.js";

const intervalSymbol /*****/ = Symbol("hs.s.interval");
const latestIndexSymbol /**/ = Symbol("hs.s.index");
const renderersSymbol /****/ = Symbol("hs.s.renderers");
const sessionSymbol /******/ = Symbol("hs.s.session");

export class HSServer {
	private [intervalSymbol]: SuspendableTimer;
	private [latestIndexSymbol]: number;
	private [renderersSymbol]: HSBaseRendererConstructor[];
	private [sessionSymbol]: HSSession = null;

	constructor(...renderers: HSBaseRendererConstructor[]) {
		this[renderersSymbol] = renderers.filter((Renderer) => Renderer.supportedType);
	}

	/**
	 * Creates a new subtitles / captions
	 * distribution session.
	 *
	 * @param rawTracks
	 * @param mimeType
	 * @returns
	 */

	public createSession(rawTracks: RawTrack[], mimeType: `${"application" | "text"}/${string}`) {
		this[sessionSymbol] = null;

		for (let i = 0; i < this[renderersSymbol].length; i++) {
			const Renderer = this[renderersSymbol][i];

			if (Renderer instanceof HSBaseRenderer && Renderer.supportedType === mimeType) {
				this[sessionSymbol] = new HSSession(rawTracks, new Renderer());
				return;
			}
		}

		console.warn(
			`No renderer supports this content type (${mimeType}} or the passed Renderers do not extend "HSBaseRenderer". Engine won't render anything.`,
		);
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

		this[intervalSymbol] = new SuspendableTimer(frequencyMs, () => {
			/**
			 * @TODO query the [selectedSourceSymbol] and request the next subtitle.
			 * This might be structured upon iterators. [selectedSourceSymbol] will
			 * accept the value of [latestIndexSymbol] as parameter so server
			 * will be the only one to be stateful.
			 *
			 * @TODO Setup listeners and set sending events to the functions.
			 */
		});

		this[intervalSymbol].start();
	}

	/**
	 * Suspends serving action without losing
	 * frequency and `getCurrentPosition` reference.
	 *
	 * @returns
	 */

	public suspend() {
		this[intervalSymbol]?.stop();
	}

	/**
	 * Resumes serving activity by using the previously
	 * provided frequency and `getCurrentPosition`.
	 *
	 * @returns
	 */

	public resume() {
		this[intervalSymbol]?.start();
	}

	/**
	 * Tells if this session is actively serving
	 * subtitles
	 */

	public get isRunning() {
		return this[intervalSymbol].isRunning;
	}

	/**
	 * Destroys current session and all the loaded
	 * subtitles data. Maintains the renderers.
	 */

	public destroy() {
		this.suspend();
		this[intervalSymbol] = undefined;
		this[sessionSymbol] = undefined;
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
