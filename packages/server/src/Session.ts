import { HSBaseRendererConstructor } from "@hsubs/base-renderer";
import type { RawTrack } from "./model";

interface ProcessedTrack {
	lang: string;
	content: any /** @TODO define Entities */;
}

export class HSSession<T> {
	private tracks: ProcessedTrack[];

	constructor(
		rawContents: RawTrack<T>[],
		public renderer: InstanceType<HSBaseRendererConstructor<T>>,
	) {
		for (let { lang, content } of rawContents) {
			try {
				this.tracks.push({
					lang,
					content: renderer.convertToEntities(content),
				});
			} catch (err) {
				console.error(err);
			}
		}
	}
}
