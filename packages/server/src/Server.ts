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
	cueerror: string;
}

interface HSListener<E extends keyof Events = keyof Events> {
	event: E;
	handler(data: Events[E]): void;
}

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
	 * @param rawTracks
	 * @param mimeType
	 * @returns
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
					this[sessionSymbol] = new HSSession(rawTracks, new Renderer());
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
	 * Throws if no session have been started.
	 *
	 * Throws if frequency is explicitly set to a _falsy_ value
	 * or to a value which is not a number.
	 *
	 * @param getCurrentPosition
	 * @param frequencyMs - defaults to 250ms
	 * @returns
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
	 * @returns
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
	 * @returns
	 */

	public suspend(emitStop: boolean = false): void {
		assertIntervalStarted(this[intervalSymbol]);
		assertIntervalRunning(this[intervalSymbol]);

		this[intervalSymbol]?.stop();

		if (emitStop) {
			emitEvent(this[listenersSymbol], "cuestop", undefined);
		}
	}

	/**
	 * Resumes serving activity by using the previously
	 * provided frequency and `getCurrentPosition`.
	 *
	 * @returns
	 */

	public resume(): void {
		assertIntervalStarted(this[intervalSymbol]);
		assertIntervalNotRunning(this[intervalSymbol]);

		this[intervalSymbol]?.start();
	}

	/**
	 * Tells if this session is actively serving
	 * subtitles
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
	 */

	public destroy(): void {
		this.suspend(true);

		this[intervalSymbol] = undefined;
		this[sessionSymbol] = undefined;
	}

	/**
	 * Allows to receive events when a new set of cues is available to be
	 * shown (`"cuestart"`) or when they should get hidden (`"cuestop"`).
	 *
	 * @param event
	 * @param handler
	 */

	public addEventListener(event: "cuestart", handler: (cueData: CueNode[]) => void): void;
	public addEventListener(event: "cuestop", handler: () => void): void;
	public addEventListener<K extends "cuestart" | "cuestop">(
		event: K,
		handler: (cueData?: CueNode[]) => void,
	): void {
		this[listenersSymbol].push({ event, handler });
	}

	/**
	 * Allows to remove a listener for both `cuestart` and `cuestop`.
	 * Requires handler to be one added early through `addEventListener`.
	 *
	 * @param event
	 * @param handler
	 */

	public removeEventListener(event: "cuestart" | "cuestop", handler: Function): void {
		const index = this[listenersSymbol].findIndex(
			(listener) => listener.event === event && listener.handler === handler,
		);

		if (index === -1) {
			return;
		}

		this[listenersSymbol].splice(index, 1);
	}

	/**
	 * Given a language as parameter, it attempts to switch to
	 * that language, if available among the valid ones. Passing
	 * a falsy value to `lang` will result in server suspension
	 * with a `"cuestop"` emission.
	 *
	 * @param lang
	 * @returns
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

function assertSessionInitialized(session: HSSession): asserts session is HSSession {
	if (!session) {
		throw new Error("No session started. Engine won't serve any subtitles.");
	}
}

function assertIntervalStarted(interval: SuspendableTimer): asserts interval is SuspendableTimer {
	if (!interval) {
		throw new Error("Server has not been started at all. Cannot perform operation.");
	}
}

function assertIntervalNotRunning(
	interval: SuspendableTimer,
): asserts interval is SuspendableTimer & { isRunning: false } {
	if (interval?.isRunning) {
		throw new Error("Server is already running. Cannot perform operation.");
	}
}

function assertIntervalRunning(
	interval: SuspendableTimer,
): asserts interval is SuspendableTimer & { isRunning: true } {
	if (!interval?.isRunning) {
		throw new Error("Server has been started but is not running. Cannot perform operation.");
	}
}
