import type { RawTrack } from "./model";
import type { CueNode } from "./CueNode.js";
import { BaseAdapter, BaseAdapterConstructor } from "./BaseAdapter/index.js";
import { DistributionSession } from "./DistributionSession.js";
import { SuspendableTimer } from "./SuspendableTimer.js";
import {
	AdaptersMissingError,
	NoAdaptersFoundError,
	UnsupportedContentError,
	OutOfRangeFrequencyError,
	ParsingError,
	AdapterNotExtendingPrototypeError,
	AdapterNotOverridingToStringError,
} from "./Errors/index.js";

const intervalSymbol /***/ = Symbol("sub37.s.interval");
const adaptersSymbol /**/ = Symbol("sub37.s.adapters");
const sessionSymbol /****/ = Symbol("sub37.s.session");
const listenersSymbol /**/ = Symbol("sub37.s.listeners");

export enum Events {
	CUE_START = "cuestart",
	CUE_STOP = "cuestop",
	CUES_FETCH = "cuesfetch",
	CUE_ERROR = "cueerror",
}

interface EventsPayloadMap {
	[Events.CUE_START]: CueNode[];
	[Events.CUE_STOP]: void;
	[Events.CUES_FETCH]: CueNode[];
	[Events.CUE_ERROR]: Error;
}

interface HSListener<EventName extends Events = Events> {
	event: EventName;
	handler(data: EventsPayloadMap[EventName]): void;
}

/**
 * Core of the whole captions system.
 * Instance it with a set of adapterss for the
 * contents you might receive.
 *
 * Protocol-conforming Adapterss will be saved
 * and will survive across different sessions.
 *
 * Refer to the documentation for more information
 * about the protocol.
 *
 * @throws if no Adapter is passed to the constructor.
 * @throws if none of the Adapters is conform to the protocol.
 */

export class Server {
	private [intervalSymbol]: SuspendableTimer | undefined = undefined;
	private [adaptersSymbol]: BaseAdapterConstructor[];
	private [sessionSymbol]: DistributionSession | undefined = undefined;
	private [listenersSymbol]: HSListener[] = [];

	constructor(...adapters: BaseAdapterConstructor[]) {
		if (!adapters.length) {
			throw new AdaptersMissingError();
		}

		this[adaptersSymbol] = adapters.filter((Adapter) => {
			try {
				if (Adapter.toString() === "default") {
					throw new AdapterNotOverridingToStringError();
				}

				if (Object.getPrototypeOf(Adapter) !== BaseAdapter) {
					throw new AdapterNotExtendingPrototypeError(Adapter.toString());
				}

				return Boolean(Adapter.supportedType);
			} catch (err) {
				/** Otherwise developers will never know why a Adapter got discarded ¯\_(ツ)_/¯ */
				console.error(err);
				return false;
			}
		});

		if (!this[adaptersSymbol].length) {
			throw new NoAdaptersFoundError();
		}
	}

	/**
	 * Creates a new subtitles / captions
	 * distribution session.
	 *
	 * @throws if no provided adapters support the content mimeType
	 * @throws if session cannot be created due to errors (whatever
	 * 			happens in the selected adapter and that gets catched
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

		for (let i = 0; i < this[adaptersSymbol].length; i++) {
			const Adapter = this[adaptersSymbol][i];

			if (Adapter.supportedType === mimeType) {
				try {
					this[sessionSymbol] = new DistributionSession(
						rawTracks,
						new Adapter(),
						(error: Error) => {
							emitEvent(this[listenersSymbol], Events.CUE_ERROR, error);
						},
					);
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
	 * @param options
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
			emitEvent(this[listenersSymbol], Events.CUES_FETCH, this[sessionSymbol].getAll());
		}

		let lastUsedCues = new Set<CueNode>();

		this[intervalSymbol] = new SuspendableTimer(frequencyMs, (currentTime?: number) => {
			try {
				assertSessionInitialized(this[sessionSymbol]);
			} catch (err) {
				this.suspend(true);
				throw err;
			}

			const nextCues = this[sessionSymbol].getActiveCues(currentTime || getCurrentPosition());
			const nextCache = new Set([...nextCues]);

			if (isCueCacheEqual(lastUsedCues, nextCache)) {
				return;
			}

			lastUsedCues = nextCache;

			if (!nextCues.length) {
				emitEvent(this[listenersSymbol], Events.CUE_STOP, undefined);
				return;
			}

			emitEvent(this[listenersSymbol], Events.CUE_START, nextCues);
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
			emitEvent(this[listenersSymbol], Events.CUE_STOP, undefined);
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
	 * subtitles data. Maintains the adapters.
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

	public addEventListener<EventName extends Events>(
		event: EventName,
		handler: (args: EventsPayloadMap[EventName]) => void,
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

	public removeEventListener(event: Events, handler: Function): void {
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

function emitEvent<EventName extends Events>(
	pool: HSListener<EventName>[],
	eventName: EventName,
	data: EventsPayloadMap[EventName],
): void {
	for (let { event, handler } of pool) {
		if (event === eventName) {
			handler(data);
		}
	}
}

function assertSessionInitialized(
	session: DistributionSession | undefined,
): asserts session is DistributionSession {
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
