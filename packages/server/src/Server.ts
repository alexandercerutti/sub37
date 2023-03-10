import type { CueNode } from "./CueNode.js";
import type { Track, TrackRecord } from "./Track/index.js";
import { BaseAdapter, BaseAdapterConstructor } from "./BaseAdapter/index.js";
import { SessionTrack, DistributionSession } from "./DistributionSession.js";
import { SuspendableTimer } from "./SuspendableTimer.js";
import {
	AdaptersMissingError,
	NoAdaptersFoundError,
	UnsupportedContentError,
	OutOfRangeFrequencyError,
	ParsingError,
	AdapterNotExtendingPrototypeError,
	AdapterNotOverridingToStringError,
	SessionNotStartedError,
	SessionNotInitializedError,
	ServerAlreadyRunningError,
	ServerNotRunningError,
} from "./Errors/index.js";

const intervalSymbol /***/ = Symbol("sub37.s.interval");
const adaptersSymbol /**/ = Symbol("sub37.s.adapters");
const sessionSymbol /****/ = Symbol("sub37.s.session");
const listenersSymbol /**/ = Symbol("sub37.s.listeners");

export const Events = {
	CUE_START: "cuestart",
	CUE_STOP: "cuestop",
	CUES_FETCH: "cuesfetch",
	CUE_ERROR: "cueerror",
} as const;

export type Events = typeof Events[keyof typeof Events];

export interface EventsPayloadMap {
	[Events.CUE_START]: CueNode[];
	[Events.CUE_STOP]: void;
	[Events.CUES_FETCH]: CueNode[];
	[Events.CUE_ERROR]: Error;
}

interface EventDescriptor<EventName extends Events = Events> {
	event: EventName;
	handler(data: EventsPayloadMap[EventName]): void;
}

/**
 * Core of the whole captions system.
 * Instance it with a set of adapters for the
 * contents you might receive.
 *
 * Protocol-conforming adapters will be saved
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
	private [listenersSymbol]: EventDescriptor[] = [];

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
	 * @throws if any of the tracks is not supported by any adapter
	 * @throws if session cannot be created due to errors (whatever
	 * 			happens in the selected adapter and that gets catched
	 * 			and forwarded).
	 *
	 * @param records
	 * @returns {void}
	 */

	public createSession(records: TrackRecord[]): void {
		try {
			this.destroy();
		} catch {}

		const sessionTracks: SessionTrack[] = records.map((track) => {
			const Adapter = this[adaptersSymbol].find(
				(adapter) => adapter.supportedType === track.mimeType,
			);

			if (!Adapter) {
				throw new UnsupportedContentError(track.mimeType);
			}

			return {
				...track,
				adapter: new Adapter(),
			};
		});

		try {
			this[sessionSymbol] = new DistributionSession(sessionTracks, (error: Error) => {
				emitEvent(this[listenersSymbol], Events.CUE_ERROR, error);
			});
			return;
		} catch (err: unknown) {
			throw new ParsingError(err);
		}
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
		assertSessionPaused(this[intervalSymbol]);

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

			/**
			 * It feels so useless to keep the interval active
			 * if there's no track active... don't you agree?
			 */

			if (!this[sessionSymbol].activeTracks.length) {
				/**
				 * Preventing previous suspensions and
				 * time updates to make this crash
				 */

				if (this.isRunning) {
					this.suspend(true);
				}

				return;
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
	 * @param currentTimeMs expressed in milliseconds
	 * @returns {void}
	 */

	public updateTime(currentTimeMs: number): void {
		assertSessionStarted(this[intervalSymbol]);
		assertSessionPaused(this[intervalSymbol]);

		this[intervalSymbol].runTick(currentTimeMs);
	}

	/**
	 * Suspends serving action without losing
	 * frequency and `getCurrentPosition` reference.
	 *
	 * @returns {void}
	 */

	public suspend(emitStop: boolean = false): void {
		assertSessionStarted(this[intervalSymbol]);
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
		assertSessionStarted(this[intervalSymbol]);
		assertSessionPaused(this[intervalSymbol]);

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
			assertSessionStarted(this[intervalSymbol]);
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
	 * Shortcut for using map on `Server.prototype.tracks`.
	 *
	 * @throws if session has not been created
	 * @returns {string[]}
	 */

	public get availableLanguages(): string[] {
		return this.tracks.map((track) => track.lang);
	}

	/**
	 * Allows retrieving the available tracks.
	 *
	 * @throws if session has not been created
	 * @returns {Track[]} Live reference to actual tracks.
	 * 										Changing the returned array will
	 * 										influence the available tracks
	 */

	public get tracks(): Track[] {
		assertSessionInitialized(this[sessionSymbol]);

		return this[sessionSymbol].availableTracks;
	}

	/**
	 * Given an available language identifier as parameter, it attempts to
	 * switch to that language.
	 *
	 * The currently active langs will be deactivated. Passing a falsy value
	 * to `lang` will result in all track deactivation and server suspension,
	 * with a `cuestop` being emitted.
	 *
	 * If many tracks with the same language are available, the
	 * first one in order of adding will be chosen.
	 *
	 * If the provided language identifier doesn't match any of the provided
	 * tracks or the track found is already active, this will result in a noop.
	 *
	 * @throws if session has not been created
	 *
	 * @param lang
	 * @returns {void}
	 */

	public switchTextTrackByLang(lang: string | undefined | null): void {
		assertSessionInitialized(this[sessionSymbol]);

		const activeTracks = this[sessionSymbol].activeTracks;

		if (!lang) {
			this.suspend(true);

			for (const activeTrack of activeTracks) {
				activeTrack.active = false;
			}

			return;
		}

		const track = this.tracks.find((track) => track.lang === lang);

		if (!track || track.active) {
			return;
		}

		for (const activeTrack of activeTracks) {
			activeTrack.active = false;
		}

		track.active = true;
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
	pool: EventDescriptor<EventName>[],
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
		throw new SessionNotInitializedError();
	}
}

function assertSessionStarted(
	interval: SuspendableTimer | undefined,
): asserts interval is SuspendableTimer {
	if (!interval) {
		throw new SessionNotStartedError();
	}
}

function assertSessionPaused(
	interval: SuspendableTimer | undefined,
): asserts interval is SuspendableTimer & { isRunning: false } {
	if (interval?.isRunning) {
		throw new ServerAlreadyRunningError();
	}
}

function assertIntervalRunning(
	interval: SuspendableTimer | undefined,
): asserts interval is SuspendableTimer & { isRunning: true } {
	if (!interval?.isRunning) {
		throw new ServerNotRunningError();
	}
}
