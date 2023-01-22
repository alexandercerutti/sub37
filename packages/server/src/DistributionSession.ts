import type { TrackRecord } from "./Track";
import { CueNode } from "./CueNode.js";
import { BaseAdapterConstructor } from "./BaseAdapter/index.js";
import { ActiveTrackMissingError } from "./Errors/index.js";
import { Track } from "./Track";

export interface SessionTrack extends TrackRecord {
	adapter: InstanceType<BaseAdapterConstructor>;
}

export class DistributionSession {
	private tracks: Track[] = [];
	private onSafeFailure: (error: Error) => void;

	constructor(tracks: SessionTrack[], onSafeFailure: DistributionSession["onSafeFailure"]) {
		this.onSafeFailure = onSafeFailure;

		for (const sessionTrack of tracks) {
			this.addChunkToTrack(sessionTrack);
		}

		if (Object.keys(this.tracks).length) {
			this.activeTrack = Object.keys(this.tracks)[0];
		}
	}

	public getAll(): CueNode[] {
		const nodes: CueNode[] = [];

		for (const track of this.tracks) {
			if (track.active) {
				nodes.push(...track.cues);
			}
		}

		return nodes;
	}

	public get availableTracks(): Track[] {
		return [...this.tracks];
	}

	public get activeTracks(): Track[] {
		return this.tracks.filter((track) => track.active);
	}

	public set activeTrack(lang: string) {
		const track = this.tracks.find((track) => track.lang === lang);

		if (!track) {
			console.warn("Missing language. Active track wasn't set.");
			return;
		}

		track.active = true;
	}

	public getActiveCues(time: number): CueNode[] {
		if (!this.activeTracks.length) {
			throw new ActiveTrackMissingError();
		}

		return this.activeTracks.flatMap((track) => track.getActiveCues(time));
	}

	/**
	 * Allows adding a chunks to be processed by an adapter
	 * and get inserted into track's timeline.
	 *
	 * @param sessionTrack
	 */

	private addChunkToTrack(sessionTrack: SessionTrack) {
		const { lang, content, mimeType, adapter, active = false } = sessionTrack;
		const track = new Track(lang, mimeType, adapter, this.onSafeFailure);
		track.active = active;

		this.tracks.push(track);
		track.addChunk(content);
	}
}
