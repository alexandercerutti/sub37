import { HSBaseRenderer, HSBaseRendererConstructor } from "./BaseRenderer";
import { RawTrack } from "./model";
import { HSSession } from "./Session.js";
import { SuspendableTimer } from "./SuspendableTimer.js";
import { CueNode } from "./TimelineTree";

const intervalSymbol /***/ = Symbol("hs.s.interval");
const renderersSymbol /**/ = Symbol("hs.s.renderers");
const sessionSymbol /****/ = Symbol("hs.s.session");
const listenersSymbol /**/ = Symbol("hs.s.listeners");

type HSListener =
	| {
			event: "cuestart";
			handler(cue: CueNode[]): void;
	  }
	| {
			event: "cuestop";
			handler(): void;
	  };

export class HSServer {
	private [intervalSymbol]: SuspendableTimer;
	private [renderersSymbol]: HSBaseRendererConstructor[];
	private [sessionSymbol]: HSSession = null;
	private [listenersSymbol]: HSListener[] = [];

	constructor(...renderers: HSBaseRendererConstructor[]) {
		if (!renderers.length) {
			throw new Error("HSServer is expected to be initialized with renderers. Received none.");
		}

		this[renderersSymbol] = renderers.filter((Renderer) => {
			try {
				return Object.getPrototypeOf(Renderer) === HSBaseRenderer && Renderer.supportedType;
			} catch (err) {
				return false;
			}
		});

		if (!this[renderersSymbol].length) {
			throw new Error(
				"HSServer didn't find any suitable Renderer.\nPlease ensure yourself for them to extend HSBaseRenderer and to have a static property 'supportedType'.",
			);
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

	public createSession(rawTracks: RawTrack[], mimeType: `${"application" | "text"}/${string}`) {
		try {
			this.destroy();
		} catch {}

		for (let i = 0; i < this[renderersSymbol].length; i++) {
			const Renderer = this[renderersSymbol][i];

			if (Renderer.supportedType === mimeType) {
				this[sessionSymbol] = new HSSession(rawTracks, new Renderer());
				return;
			}
		}

		console.warn(
			`No renderer supports this content type (${mimeType}). Engine won't render anything.`,
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
		assertSessionInitialized.call(this);
		assertIntervalNotRunning.call(this);

		if (!frequencyMs || typeof frequencyMs !== "number") {
			throw new Error(
				"Cannot start subtitles server: a frequency is required to be either be set to a value > 0 or not be set (fallback to 250ms)",
			);
		}

		let lastUsedCues = new Set<CueNode>();

		this[intervalSymbol] = new SuspendableTimer(frequencyMs, () => {
			const currentTime = getCurrentPosition();
			const nextCues = this[sessionSymbol].getActiveCues(currentTime);
			const nextCache = new Set([...nextCues]);

			if (isCueCacheEqual(lastUsedCues, nextCache)) {
				return;
			}

			lastUsedCues = nextCache;

			if (!nextCues.length) {
				emitEvent(this[listenersSymbol], "cuestop");
				return;
			}

			emitEvent(this[listenersSymbol], "cuestart", nextCues);
		});

		this[intervalSymbol].start();
	}

	/**
	 * Suspends serving action without losing
	 * frequency and `getCurrentPosition` reference.
	 *
	 * @returns
	 */

	public suspend(emitStop: boolean = false) {
		assertIntervalStarted.call(this);
		assertIntervalRunning.call(this);

		this[intervalSymbol]?.stop();

		if (emitStop) {
			emitEvent(this[listenersSymbol], "cuestop");
		}
	}

	/**
	 * Resumes serving activity by using the previously
	 * provided frequency and `getCurrentPosition`.
	 *
	 * @returns
	 */

	public resume() {
		assertIntervalStarted.call(this);
		assertIntervalNotRunning.call(this);

		this[intervalSymbol]?.start();
	}

	/**
	 * Tells if this session is actively serving
	 * subtitles
	 */

	public get isRunning() {
		assertIntervalStarted.call(this);

		return this[intervalSymbol].isRunning;
	}

	/**
	 * Destroys current session and all the loaded
	 * subtitles data. Maintains the renderers.
	 */

	public destroy() {
		this.suspend(true);

		this[intervalSymbol] = undefined;
		this[sessionSymbol] = undefined;
	}

	public addEventListener(event: "cuestart", handler: (cueData: CueNode[]) => void): void;
	public addEventListener(event: "cuestop", handler: () => void): void;
	public addEventListener<K extends "cuestart" | "cuestop">(
		event: K,
		handler: (cueData?: CueNode[]) => void,
	): void {
		this[listenersSymbol].push({ event, handler });
	}

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
	 * Provided a language to select, it attempts to switch to
	 * that language among the valid ones.
	 *
	 * @param lang
	 * @returns
	 */

	public selectTextTrack(lang: string) {
		assertSessionInitialized.call(this);

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

function isCueCacheEqual(last: Set<CueNode>, next: Set<CueNode>) {
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

function emitEvent(pool: HSListener[], eventName: HSListener["event"], data?: CueNode[]) {
	for (let i = 0; i < pool.length; i++) {
		const { event, handler } = pool[i];
		if (event === eventName) {
			handler(data);
		}
	}
}

function assertSessionInitialized(this: HSServer) {
	if (!this[sessionSymbol]) {
		throw new Error("No session started. Engine won't serve any subtitles.");
	}
}

function assertIntervalStarted(this: HSServer) {
	if (!this[intervalSymbol]) {
		throw new Error("Server has not been started at all. Cannot perform operation.");
	}
}

function assertIntervalNotRunning(this: HSServer) {
	if (this[intervalSymbol]?.isRunning) {
		throw new Error("Server is already running. Cannot perform operation.");
	}
}

function assertIntervalRunning(this: HSServer) {
	if (!this[intervalSymbol].isRunning) {
		throw new Error("Server has been started but is not running. Cannot perform operation.");
	}
}
