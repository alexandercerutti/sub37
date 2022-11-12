import type { RawTrack } from "./model";
import { CueNode } from "./CueNode.js";
import { IntervalBinaryTree } from "./IntervalBinaryTree.js";
import { HSBaseRendererConstructor, ParseResult } from "./BaseRenderer/index.js";
import {
	UncaughtParsingExceptionError,
	UnexpectedDataFormatError,
	UnexpectedParsingOutputFormatError,
	UnparsableContentError,
	ActiveTrackMissingError,
} from "./Errors/index.js";

const activeTrackSymbol = Symbol("session.active");

export class HSSession {
	private timelines: { [lang: string]: IntervalBinaryTree<CueNode> } = Object.create(null);
	private [activeTrackSymbol]: string = null;
	private renderer: InstanceType<HSBaseRendererConstructor>;
	private onSafeFailure: (error: Error) => void;

	constructor(
		rawContents: RawTrack[],
		renderer: HSSession["renderer"],
		onSafeFailure: HSSession["onSafeFailure"],
	) {
		this.renderer = renderer;
		this.onSafeFailure = onSafeFailure;

		this.addChunks(...rawContents);

		if (Object.keys(this.timelines).length) {
			this.activeTrack = Object.keys(this.timelines)[0];
		}
	}

	public getAll(): CueNode[] {
		return this.timelines[this[activeTrackSymbol]].getAll();
	}

	public get availableTracks(): string[] {
		return Object.keys(this.timelines);
	}

	public get activeTrack(): string {
		return this[activeTrackSymbol];
	}

	public set activeTrack(lang: string) {
		if (!this.timelines[lang]) {
			console.warn("Missing language. Active track wasn't set.");
			return;
		}

		this[activeTrackSymbol] = lang;
	}

	public getActiveCues(time: number): CueNode[] {
		if (!this.activeTrack) {
			throw new ActiveTrackMissingError();
		}

		return this.timelines[this.activeTrack].getCurrentNodes(time);
	}

	/**
	 * Allows adding a chunks to be processed by a renderer
	 * and get inserted into a timeline.
	 *
	 * @param tracks
	 */

	public addChunks(...tracks: RawTrack[]) {
		try {
			for (const { lang, content } of tracks) {
				const parseResult = this.renderer.parse(content);

				if (!(parseResult instanceof ParseResult)) {
					/** If parser fails once for this reason, it is worth to stop the whole ride. */
					throw new UnexpectedParsingOutputFormatError(this.renderer.toString(), lang, parseResult);
				}

				if (parseResult.data.length) {
					if (!this.timelines[lang]) {
						this.timelines[lang] = new IntervalBinaryTree();
					}

					for (const cue of parseResult.data) {
						if (!(cue instanceof CueNode)) {
							parseResult.errors.push({
								error: new UnexpectedDataFormatError(this.renderer.toString()),
								failedChunk: cue,
								isCritical: false,
							});

							continue;
						}

						this.timelines[lang].addNode(cue);
					}
				} else if (parseResult.errors.length >= 1) {
					throw new UnparsableContentError(this.renderer.toString(), parseResult.errors[0]);
				}

				for (const parseResultError of parseResult.errors) {
					this.onSafeFailure(parseResultError.error);
				}
			}
		} catch (err: unknown) {
			if (
				err instanceof UnexpectedParsingOutputFormatError ||
				err instanceof UnparsableContentError
			) {
				throw err;
			}

			throw new UncaughtParsingExceptionError(this.renderer.toString(), err);
		}
	}
}
