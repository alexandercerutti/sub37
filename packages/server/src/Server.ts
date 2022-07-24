import { HSBaseRenderer, HSBaseRendererConstructor } from "./BaseRenderer/index.js";
import { RawTrack, CueNode } from "./model";
import { HSSession } from "./Session.js";
import { SuspendableTimer } from "./SuspendableTimer.js";

const intervalSymbol /***/ = Symbol("hs.s.interval");
const renderersSymbol /**/ = Symbol("hs.s.renderers");
const sessionSymbol /****/ = Symbol("hs.s.session");
const listenersSymbol /**/ = Symbol("hs.s.listeners");

type HSListener =
	| {
			event: "cuestart" | "cuesfetch";
			handler(cues: CueNode[]): void;
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

	public start(
		getCurrentPosition: () => number,
		frequencyMs: number = 250,
		options?: { karaoke?: boolean },
	) {
		assertSessionInitialized.call(this);
		assertIntervalNotRunning.call(this);

		if (!frequencyMs || typeof frequencyMs !== "number") {
			throw new Error(
				"Cannot start subtitles server: a frequency is required to be either be set to a value > 0 or not be set (fallback to 250ms)",
			);
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
				emitEvent(this[listenersSymbol], "cuestop");
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

	public updateTime(currentTime: number) {
		assertIntervalStarted.call(this);
		assertIntervalNotRunning.call(this);

		this[intervalSymbol].runTick(currentTime);
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
		try {
			assertIntervalStarted.call(this);
		} catch (err) {
			return false;
		}

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

	public selectTextTrack(lang: string | undefined | null) {
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
