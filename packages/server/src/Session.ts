import { HSBaseRendererConstructor } from "@hsubs/base-renderer";
import type { RawTrack } from "./model";
import { TimelineTree } from "./TimelineTree";

export class HSSession {
	private timelines: { [lang: string]: TimelineTree };

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
	}
}