import type { RawTrack } from "./model";
import { CueNode } from "./CueNode.js";
import { IntervalBinaryTree } from "./IntervalBinaryTree.js";
import { HSBaseRendererConstructor, ParseResult } from "./BaseRenderer/index.js";
import { UnexpectedParsingOutputFormatError } from "./Errors/index.js";

const activeTrackSymbol = Symbol("session.active");

export class HSSession {
	private timelines: { [lang: string]: IntervalBinaryTree<CueNode> } = Object.create(null);
	private [activeTrackSymbol]: string = null;

	constructor(rawContents: RawTrack[], public renderer: InstanceType<HSBaseRendererConstructor>) {
		const { rendererName } = Object.getPrototypeOf(renderer)
			.constructor as HSBaseRendererConstructor;

		for (const { lang, content } of rawContents) {
			try {
				const parseResult = renderer.parse(content);

				if (!(parseResult instanceof ParseResult)) {
					throw new UnexpectedParsingOutputFormatError(rendererName, lang, parseResult);
				}

				if (parseResult.data.length) {
					this.timelines[lang] = new IntervalBinaryTree();

					for (const cue of parseResult.data) {
						if (!(cue instanceof CueNode)) {
							continue;
						}

						this.timelines[lang].addNode(cue);
					}
				}
			} catch (err) {
				console.error(err);
				/**
				 * @TODO Emit renderer error
				 */
			}
		}

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
			throw new Error("No active track found. Cannot retrieve active cues");
		}

		return this.timelines[this.activeTrack].getCurrentNodes(time);
	}
}
