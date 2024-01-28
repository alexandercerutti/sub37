import "@sub37/captions-renderer";
import { Server } from "@sub37/server";
import { WebVTTAdapter } from "@sub37/webvtt-adapter";
import { TTMLAdapter } from "@sub37/ttml-adapter";
import longTextTrackVTTPath from "../../src/longtexttrack.vtt";
import longTextTrackVTTPathChunk from "../../src/longtexttrack-chunk1.vtt";
import "../../src/components/customElements/scheduled-textarea";
import "../../src/components/customElements/fake-video";

/**
 * @typedef {import("../../src/components/customElements/fake-video").FakeHTMLVideoElement} FakeHTMLVideoElement
 * @typedef {import("../../src/components/customElements/scheduled-textarea").ScheduledTextArea} ScheduledTextArea
 * @typedef {import("@sub37/captions-renderer").Renderer} CaptionsRenderer
 */

/**
 * @type {HTMLButtonElement}
 */

const defaultTrackLoadBtn = document.getElementById("load-default-track");

/**
 * @type {Server}
 */

const server = new Server(WebVTTAdapter, TTMLAdapter);

/**
 * @type {FakeHTMLVideoElement}
 */

const videoTag = document.getElementsByTagName("fake-video")[0];
videoTag.duration = 7646;

/**
 * @type {ScheduledTextArea}
 */

const scheduledTextArea = document.getElementsByTagName("scheduled-textarea")?.[0];

/**
 * @type {CaptionsRenderer}
 */

const presenter = document.getElementById("presenter");

/**
 * @param {FakeHTMLVideoElement} videoElement
 */

function togglePlayback(videoElement) {
	if (videoElement.paused) {
		videoElement.play();
	} else {
		videoElement.pause();
	}
}

defaultTrackLoadBtn.addEventListener("click", async () => {
	// 			WEBVTT

	// REGION
	// id:fred
	// width:40%
	// lines:3
	// align:center
	// regionanchor:0%,100%
	// viewportanchor:10%,90%
	// scroll:up

	// REGION
	// id:bill
	// align:right
	// width:40%
	// lines:3
	// regionanchor:0%,100%
	// viewportanchor:10%,90%
	// scroll:up

	// 00:00:00.000 --> 00:10:00.000 region:fred align:left
	// Hello world.

	// 00:00:03.000 --> 00:10:00.000 region:bill align:right
	// Hello milady ;)

	// 00:00:04.000 --> 00:10:00.000 region:fred align:left
	// Hello world, bibi

	document.forms["content-type"].elements.webvtt.checked = true;
	defaultTrackLoadBtn.disabled = true;

	const [vttTrack, vttChunk] = await Promise.all([
		fetch(longTextTrackVTTPath).then((e) => e.text()),
		fetch(longTextTrackVTTPathChunk).then((e) => e.text()),
	]);

	setTimeout(() => {
		server.tracks[0].addChunk(vttChunk);
	}, 3000);

	scheduledTextArea.value = vttTrack;
	defaultTrackLoadBtn.disabled = false;
});

document.addEventListener("keydown", ({ code }) => {
	switch (code) {
		case "ArrowLeft": {
			videoTag.currentTime = videoTag.currentTime - 10;
			break;
		}
		case "ArrowRight": {
			videoTag.currentTime = videoTag.currentTime + 10;
			break;
		}
		case "Space": {
			togglePlayback(videoTag);
			break;
		}
	}
});

videoTag.addEventListener("seeked", () => {
	if (videoTag.paused) {
		server.updateTime(videoTag.currentTime * 1000);
	}
});

videoTag.addEventListener("playing", () => {
	if (server.isRunning) {
		server.resume();
		return;
	}

	server.start(() => {
		return parseFloat(videoTag.currentTime) * 1000;
	});
});

videoTag.addEventListener("pause", () => {
	if (server.isRunning) {
		server.suspend();
	}
});

scheduledTextArea.addEventListener("commit", async ({ detail: track }) => {
	const contentMimeType = document.forms["content-type"].elements["caption-type"].value;

	const timeStart = performance.now();

	try {
		/**
		 * Just a trick to not let the browser complaining
		 * about the commit timeout taking too long to complete
		 * and defer the parsing.
		 * (the default track should take like 160ms to parse)
		 */

		await Promise.resolve();

		const isWebVTTTrackSelected = contentMimeType === "text/vtt";
		const isTTMLTrackSelected = contentMimeType === "application/ttml+xml";

		server.createSession([
			{
				lang: "any",
				content: track,
				mimeType: contentMimeType,
				active: true,
			},
		]);
		console.info(
			`%c[DEBUG] Track parsing took: ${performance.now() - timeStart}ms`,
			"background-color: #af0000; color: #FFF; padding: 5px; margin: 5px",
		);
	} catch (err) {
		console.error(err);
	}

	videoTag.play();
	videoTag.currentTime = 0;
});

// server.createSession(
// 	[
// 		{
// 			lang: "it",
// 			content: `
// WEBVTT

// 00:00:00.000 --> 00:00:02.000 region:fred align:left
// <v Fred>Hi, my name is Fred

// 00:00:02.500 --> 00:00:04.500 region:bill align:right
// <v Bill>Hi, I’m Bill

// 00:00:05.000 --> 00:00:06.000 region:fred align:left
// <v Fred>Would you like to get a coffee?

// 00:00:07.500 --> 00:00:09.500 region:bill align:right
// <v Bill>Sure! I’ve only had one today.

// 00:00:10.000 --> 00:00:11.000 region:fred align:left
// <v Fred>This is my fourth!

// 00:00:12.500 --> 00:00:13.500 region:fred align:left
// <v Fred>OK, let’s go.
// `,
// 		},
// 	],
// 	"text/vtt",
// );

server.addEventListener("cueerror", (error) => {
	console.warn(error);
});

server.addEventListener("cuestart", (cues) => {
	const timeStart = performance.now();
	// console.log("CUE START:", cues);
	presenter.setCue(cues);
	console.info(
		`%c[DEBUG] Cue rendering took: ${performance.now() - timeStart}ms`,
		"background-color: #7900ff; color: #FFF; padding: 5px; margin: 5px",
		cues,
	);
});

server.addEventListener("cuestop", () => {
	console.log("CUES STOP");
	presenter.setCue();
});
