import { DebouncedOperation } from "./DebouncedOperation";

const LOCAL_STORAGE_KEY = "latest-track-text";
const schedulerOperation = Symbol("schedulerOperation");

export class TrackScheduler {
	private [schedulerOperation]: DebouncedOperation;

	constructor(private videoContainer: HTMLElement, textContainer: HTMLTextAreaElement) {
		const latestTrack = localStorage.getItem(LOCAL_STORAGE_KEY);

		if (latestTrack) {
			this.#commit(latestTrack);
			textContainer.querySelector("textarea").value = latestTrack;
		}

		textContainer.querySelector("textarea").addEventListener("input", ({ target }) => {
			this.schedule((target as HTMLInputElement).value);
		});
	}

	public set operation(fn: Function) {
		DebouncedOperation.clear(this[schedulerOperation]);
		this[schedulerOperation] = DebouncedOperation.create(fn);
	}

	public schedule(text: string) {
		this.operation = () => this.#commit(text);
	}

	#commit(text: string) {
		if (!text.length) {
			return;
		}

		const currentVideo = this.videoContainer.querySelector("video");
		const currentTrack = Array.prototype.find.call(
			currentVideo.childNodes,
			(child: HTMLElement) => child.nodeName === "TRACK",
		);

		if (currentTrack?.src) {
			this.#disposeTrackURL(currentTrack.src);
		}

		const newTrackURL = this.#createTrackURL(text);

		/**
		 * Creating again the video tag due to a bug in Chrome
		 * for which removing a textTrack element and adding a new one
		 * lefts the UI dirty
		 */

		const videoElement = Object.assign(document.createElement("video"), {
			controls: true,
			muted: true,
			src: "./big_buck_bunny_1080p_60fps.mp4",
			autoplay: true,
		});

		const track = Object.assign(document.createElement("track"), {
			src: newTrackURL,
			mode: "showing",
			default: true,
			label: "Test track",
		});

		videoElement.appendChild(track);

		this.videoContainer.querySelector("video").remove();
		this.videoContainer.appendChild(videoElement);
	}

	#createTrackURL(text: string) {
		localStorage.setItem(LOCAL_STORAGE_KEY, text);
		const blob = new Blob([text], { type: "text/vtt" });
		return URL.createObjectURL(blob);
	}

	#disposeTrackURL(trackUrl: string) {
		URL.revokeObjectURL(trackUrl);
	}
}
