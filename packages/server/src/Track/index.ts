export { default as Track } from "./Track.js";
export { appendChunkToTrack as appendChunk } from "./appendChunkToTrack.js";
export type { TrackRecord } from "./TrackRecord";

/**
 * TTA, time to availability, between starting and receiving
 * the first time
 */
export const SUB37_MARK_TTA_START = "sub37-tta-start";
export const SUB37_MARK_TTA_END = "sub37-tta-end";
