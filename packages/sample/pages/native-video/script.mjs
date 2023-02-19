import "../../src/components/customElements/scheduled-textarea";

/**
 * @type {string} text
 * @returns {string}
 */

function createTrackURL(text) {
	const blob = new Blob([text], { type: "text/vtt" });
	return URL.createObjectURL(blob);
}

/**
 * @type {string} trackUrl
 */

function disposeTrackURL(trackUrl) {
	URL.revokeObjectURL(trackUrl);
}

const videoContainer = document.getElementById("video-container");
const scheduledTextArea = document.getElementsByTagName("scheduled-textarea")?.[0];

scheduledTextArea.addEventListener("commit", ({ detail: text }) => {
	const currentVideo = videoContainer.querySelector("video");
	const currentTrack = Array.prototype.find.call(
		currentVideo.childNodes,
		(child) => child.nodeName === "TRACK",
	);

	if (currentTrack?.src) {
		disposeTrackURL(currentTrack.src);
	}

	const newTrackURL = createTrackURL(text);

	/**
	 * Creating again the video tag due to a bug in Chrome
	 * for which removing a textTrack element and adding a new one
	 * lefts the UI dirty
	 */

	const videoElement = Object.assign(document.createElement("video"), {
		controls: true,
		muted: true,
		src: currentVideo.src,
		autoplay: true,
	});

	const track = Object.assign(document.createElement("track"), {
		src: newTrackURL,
		mode: "showing",
		default: true,
		label: "Test track",
	});

	videoElement.appendChild(track);

	videoContainer.querySelector("video").remove();
	videoContainer.appendChild(videoElement);
});
