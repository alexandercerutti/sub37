import { HSBaseRendererConstructor } from "./BaseRenderer";
import type { RawTrack } from "./model";
import { TimelineTree } from "./TimelineTree.js";

const activeTrackSymbol = Symbol("session.active");

export class HSSession {
	private timelines: { [lang: string]: TimelineTree };
	private [activeTrackSymbol]: string = null;

	constructor(rawContents: RawTrack[], public renderer: InstanceType<HSBaseRendererConstructor>) {
		for (let { lang, content } of rawContents) {
			try {
				const entities = renderer.parse(content);
				this.timelines[lang] = new TimelineTree();

				/** @TODO add entities to Timeline */
			} catch (err) {
				console.error(err);
			}
		}

		if (Object.keys(this.timelines).length) {
			this.activeTrack = Object.keys(this.timelines)[0];
		}
	}

	public get activeTrack() {
		return this[activeTrackSymbol];
	}

	public set activeTrack(lang: string) {
		if (!this.timelines[lang]) {
			console.warn("Missing language. Active track wasn't set.");
			return;
		}

		this[activeTrackSymbol] = lang;
	}
}
