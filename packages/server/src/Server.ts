import type { RawTrack } from "./model";
import type { CueNode } from "./CueNode.js";
import { HSBaseRenderer, HSBaseRendererConstructor } from "./BaseRenderer/index.js";
import { HSSession } from "./Session.js";
import { SuspendableTimer } from "./SuspendableTimer.js";
import {
	RenderersMissingError,
	NoRenderersFoundError,
	UnsupportedContentError,
	OutOfRangeFrequencyError,
	ParsingError,
} from "./Errors/index.js";

const intervalSymbol /***/ = Symbol("hs.s.interval");
const renderersSymbol /**/ = Symbol("hs.s.renderers");
const sessionSymbol /****/ = Symbol("hs.s.session");
const listenersSymbol /**/ = Symbol("hs.s.listeners");

interface Events {
	cuestart: CueNode[];
	cuestop: void;
	cuesfetch: CueNode[];
	cueerror: Error;
}

interface HSListener<E extends keyof Events = keyof Events> {
	event: E;
	handler(data: Events[E]): void;
}

/**
 * Core of the whole captions system.
 * Instance it with a set of Renderers for the
 * contents you might receive.
 *
 * Protocol-conforming Renderers will be saved
 * and will survive across different sessions.
 *
 * Refer to the documentation for more information
 * about the protocol.
 *
 * @throws if no Renderer is passed to the constructor.
 * @throws if none of the Renderers is conform to the protocol.
 */

export class HSServer {
	private [intervalSymbol]: SuspendableTimer;
	private [renderersSymbol]: HSBaseRendererConstructor[];
	private [sessionSymbol]: HSSession = null;
	private [listenersSymbol]: HSListener[] = [];

	constructor(...renderers: HSBaseRendererConstructor[]) {
		if (!renderers.length) {
			throw new RenderersMissingError();
		}

		this[renderersSymbol] = renderers.filter((Renderer) => {
			try {
				return (
					Object.getPrototypeOf(Renderer) === HSBaseRenderer &&
					Renderer.supportedType &&
					Renderer.rendererName !== "default"
				);
			} catch (err) {
				return false;
			}
		});

		if (!this[renderersSymbol].length) {
			throw new NoRenderersFoundError();
		}
	}

	/**
	 * Creates a new subtitles / captions
	 * distribution session.
	 *
	 * @throws if no provided renderers support the content mimeType
	 * @throws if session cannot be created due to errors (whatever
	 * 			happens in the selected Renderer and that gets catched
	 * 			and forwarded).
	 *
	 * @param rawTracks
	 * @param mimeType
	 * @returns {void}
	 */

	public createSession(
		rawTracks: RawTrack[],
		mimeType: `${"application" | "text"}/${string}`,
	): void {
		try {
			this.destroy();
		} catch {}

		for (let i = 0; i < this[renderersSymbol].length; i++) {
			const Renderer = this[renderersSymbol][i];

			if (Renderer.supportedType === mimeType) {
				try {
					this[sessionSymbol] = new HSSession(rawTracks, new Renderer(), (error: Error) => {
						emitEvent(this[listenersSymbol], "cueerror", error);
					});
					return;
				} catch (err: unknown) {
					throw new ParsingError(err);
				}
			}
		}

		throw new UnsupportedContentError(mimeType);
	}

	/**
	 * Allows starting the server.
	 * It will start sending events through the listeners.
	 *
	 * @throws if no session have been started.
	 * @throws if frequency is explicitly set to a _falsy_ value
	 * 				 or to a value which is not a number.
	 *
	 * @param getCurrentPosition
	 * @param frequencyMs - defaults to 250ms
	 * @returns {void}
	 */

	public start(
		getCurrentPosition: () => number,
		frequencyMs: number = 250,
		options?: { karaoke?: boolean },
	): void {
		assertSessionInitialized(this[sessionSymbol]);
		assertIntervalNotRunning(this[intervalSymbol]);

		if (!frequencyMs || typeof frequencyMs !== "number" || frequencyMs < 1) {
			throw new OutOfRangeFrequencyError(frequencyMs);
		}

		if (options?.karaoke) {
			/**
			 * Emitting all the cues available so previous and next cues can be
			 * seen before or after they get highlighted, like in a Karaoke.
			 */
			emitEvent(this[listenersSymbol], "cuesfetch", this[sessionSymbol].getAll());
		}

		let lastUsedCues = new Set<CueNode>();

		this[intervalSymbol] = new SuspendableTimer(frequencyMs, (currentTime?: number) => {
			const nextCues = this[sessionSymbol].getActiveCues(currentTime || getCurrentPosition());
			const nextCache = new Set([...nextCues]);

			if (isCueCacheEqual(lastUsedCues, nextCache)) {
				return;
			}

			lastUsedCues = nextCache;

			if (!nextCues.length) {
				emitEvent(this[listenersSymbol], "cuestop", undefined);
				return;
			}

			emitEvent(this[listenersSymbol], "cuestart", nextCues);
		});

		this[intervalSymbol].start();
	}

	/**
	 * Allows to perform a manual update of the currentTime so
	 * latest cues can be served and rendered.
	 *
	 * Useful in case of paused seek, where the currentTime gets
	 * updated but the engine cannot automatically get it.
	 *
	 * @throws if the server is not started;
	 * @throws if the server is running;
	 *
	 * @param currentTime expressed in milliseconds
	 * @returns {void}
	 */

	public updateTime(currentTime: number): void {
		assertIntervalStarted(this[intervalSymbol]);
		assertIntervalNotRunning(this[intervalSymbol]);

		this[intervalSymbol].runTick(currentTime);
	}

	/**
	 * Suspends serving action without losing
	 * frequency and `getCurrentPosition` reference.
	 *
	 * @returns {void}
	 */

	public suspend(emitStop: boolean = false): void {
		assertIntervalStarted(this[intervalSymbol]);
		assertIntervalRunning(this[intervalSymbol]);

		this[intervalSymbol].stop();

		if (emitStop) {
			emitEvent(this[listenersSymbol], "cuestop", undefined);
		}
	}

	/**
	 * Resumes serving activity by using the previously
	 * provided frequency and position callback.
	 *
	 * @returns {void}
	 */

	public resume(): void {
		assertIntervalStarted(this[intervalSymbol]);
		assertIntervalNotRunning(this[intervalSymbol]);

		this[intervalSymbol].start();
	}

	/**
	 * Returns `true` if session is actively serving
	 * subtitles. Otherwise `false` (even if session
	 * has not been created)
	 *
	 * @returns {boolean}
	 */

	public get isRunning(): boolean {
		try {
			assertIntervalStarted(this[intervalSymbol]);
		} catch (err) {
			return false;
		}

		return this[intervalSymbol].isRunning;
	}

	/**
	 * Destroys current session and all the loaded
	 * subtitles data. Maintains the renderers.
	 *
	 * @returns {void}
	 */

	public destroy(): void {
		this.suspend(true);

		this[intervalSymbol] = undefined;
		this[sessionSymbol] = undefined;
	}

	/**
	 * Allows to receive events when a new set of cues is available to be shown, hidden,
	 * used or when error happens.
	 *
	 * @param event
	 * @param handler
	 * @returns {void}
	 */

	public addEventListener<K extends keyof Events>(
		event: K,
		handler: (args: Events[K]) => void,
	): void {
		this[listenersSymbol].push({ event, handler });
	}

	/**
	 * Allows to remove a listener.
	 * Requires handler to be a function previously added through `addEventListener`.
	 *
	 * @param event
	 * @param handler
	 * @returns {void}
	 */

	public removeEventListener(event: keyof Events, handler: Function): void {
		const index = this[listenersSymbol].findIndex(
			(listener) => listener.event === event && listener.handler === handler,
		);

		if (index === -1) {
			return;
		}

		this[listenersSymbol].splice(index, 1);
	}

	/**
	 * Allows retrieving the list of loaded tracks's languages.
	 *
	 * @throws if session has not been created
	 * @returns {string[]}
	 */

	public get availableLanguages(): string[] {
		assertSessionInitialized(this[sessionSymbol]);

		return this[sessionSymbol].availableTracks;
	}

	/**
	 * Given a language as parameter, it attempts to switch to
	 * that language, if available among the valid ones. Passing
	 * a falsy value to `lang` will result in server suspension
	 * with a `cuestop` event emission.
	 *
	 * @throws if session has not been created
	 *
	 * @param lang
	 * @returns {void}
	 */

	public selectTextTrack(lang: string | undefined | null): void {
		assertSessionInitialized(this[sessionSymbol]);

		if (!lang) {
			this.suspend(true);
			return;
		}

		if (this[sessionSymbol].activeTrack === lang) {
			return;
		}

		this[sessionSymbol].activeTrack = lang;
	}

	/**
	 * Allows adding a raw chunk to be parsed later, after the session has started.
	 * Useful for lazy loading and streaming of text tracks.
	 *
	 * If lang has not been previously added, it will be created internally and will
	 * become available for selection.
	 *
	 * Please note that the content must respect all the rules of the other chunks's
	 * content and **it is not relative to previously added chunks**.
	 *
	 * E.g. if a renderer requires an header part (like "WEBVTT") to be set, it is
	 * required to be available also for this chunk for it to get parsed and added
	 * correctly. Otherwise the renderer might throw.
	 *
	 * @throws if session has not been created.
	 * @param content
	 * @param lang
	 * @returns {void}
	 */

	public addTextChunk(content: unknown, lang: string): void {
		assertSessionInitialized(this[sessionSymbol]);

		this[sessionSymbol].addChunks({ content, lang });
	}
}

function isCueCacheEqual(last: Set<CueNode>, next: Set<CueNode>): boolean {
	if (last.size !== next.size) {
		return false;
	}

	for (let element of last) {
		if (!next.has(element)) {
			return false;
		}
	}

	return true;
}

function emitEvent<E extends keyof Events>(
	pool: HSListener<E>[],
	eventName: E,
	data: Events[E],
): void {
	for (let { event, handler } of pool) {
		if (event === eventName) {
			handler(data);
		}
	}
}

function assertSessionInitialized(session: HSSession | undefined): asserts session is HSSession {
	if (!session) {
		throw new Error("No session started. Engine won't serve any subtitles.");
	}
}

function assertIntervalStarted(
	interval: SuspendableTimer | undefined,
): asserts interval is SuspendableTimer {
	if (!interval) {
		throw new Error("Server has not been started at all. Cannot perform operation.");
	}
}

function assertIntervalNotRunning(
	interval: SuspendableTimer | undefined,
): asserts interval is SuspendableTimer & { isRunning: false } {
	if (interval?.isRunning) {
		throw new Error("Server is already running. Cannot perform operation.");
	}
}

function assertIntervalRunning(
	interval: SuspendableTimer | undefined,
): asserts interval is SuspendableTimer & { isRunning: true } {
	if (!interval?.isRunning) {
		throw new Error("Server has been started but is not running. Cannot perform operation.");
	}
}
