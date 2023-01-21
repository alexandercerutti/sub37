import type { BaseAdapter } from "../BaseAdapter";
import type { CueNode } from "../CueNode";
import type { SessionTrack } from "../DistributionSession";
import type { TrackRecord } from "./TrackRecord";
import { appendChunkToTrack } from "./appendChunkToTrack";
import { IntervalBinaryTree } from "../IntervalBinaryTree";

export const addCuesSymbol = Symbol("track.addcues");

export default class Track implements Omit<TrackRecord, "content"> {
	private readonly timeline: IntervalBinaryTree<CueNode>;
	private readonly onSafeFailure: (error: Error) => void;
	public readonly adapter: BaseAdapter;
	public readonly lang: string;
	public readonly mimeType: `${string}/${string}`;

	public active: boolean = false;

	public constructor(
		lang: string,
		mimeType: SessionTrack["mimeType"],
		adapter: BaseAdapter,
		onSafeFailure?: (error: Error) => void,
	) {
		this.adapter = adapter;
		this.timeline = new IntervalBinaryTree();
		this.lang = lang;
		this.mimeType = mimeType;
		this.onSafeFailure = onSafeFailure;
	}

	public getActiveCues(time: number): CueNode[] {
		return this.timeline.getCurrentNodes(time);
	}

	public [addCuesSymbol](...cues: CueNode[]) {
		for (const cue of cues) {
			this.timeline.addNode(cue);
		}
	}

	public addChunk(content: unknown) {
		appendChunkToTrack(this, content, this.onSafeFailure);
	}

	public get cues() {
		return this.timeline.getAll();
	}

	public getAdapterName(): string {
		return this.adapter.toString();
	}
}
