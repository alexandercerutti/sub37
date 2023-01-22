/**
 * Represents the track data that developers
 * will have to use to add a track
 */

export interface TrackRecord {
	lang: string;
	content: unknown;
	mimeType: `${string}/${string}`;
	active?: boolean;
}
