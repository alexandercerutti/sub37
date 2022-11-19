import "@hsubs/captions-presenter-web";
import { HSServer } from "@hsubs/server";
import { WebVTTRenderer } from "@hsubs/webvtt-renderer";
import { FakeHTMLVideoElement } from "./FakeHTMLVideoElement";
import longTextTrackVTTPath from "./longtexttrack.vtt";
import longTextTrackVTTPathChunk from "./longtexttrack-chunk1.vtt";

/**
 * @type {HSServer}
 */

const server = new HSServer(WebVTTRenderer);
const ranger = document.querySelector("#ranger input");
const currentTime = document.getElementById("currentTime");
const playbackBtn = document.getElementById("playback-btn");
const videoTag = new FakeHTMLVideoElement(parseFloat(ranger.getAttribute("max")));

/**
 *
 * @param {FakeHTMLVideoElement} videoElement
 */

function togglePlayback(videoElement) {
	if (videoElement.paused) {
		videoElement.play();
	} else {
		videoElement.pause();
	}
}

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

videoTag.addEventListener("timeupdate", (time) => {
	ranger.value = time;
	currentTime.innerText = time;
});

videoTag.addEventListener("seeked", () => {
	if (videoTag.paused) {
		server.updateTime(videoTag.currentTime * 1000);
	}
});

ranger.addEventListener("input", () => {
	const time = parseFloat(ranger.value);
	videoTag.currentTime = time;

	ranger.value = time;
	currentTime.innerText = time;

	if (server.isRunning) {
		return;
	}

	server.updateTime(time * 1000);
});

playbackBtn.addEventListener("click", () => {
	togglePlayback(videoTag);
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

const [vttTrack, vttChunk] = await Promise.all([
	fetch(longTextTrackVTTPath).then((e) => e.text()),
	fetch(longTextTrackVTTPathChunk).then((e) => e.text()),
]);

const timeStart = performance.now();

server.createSession(
	[
		{
			lang: "it",
			content: vttTrack,
		},
	],
	"text/vtt",
);
console.info(
	`%c[DEBUG] Track parsing took: ${performance.now() - timeStart}ms`,
	"background-color: #af0000; color: #FFF; padding: 5px; margin: 5px",
);

videoTag.addEventListener("playing", () => {
	if (server.isRunning) {
		server.resume();
		return;
	}

	server.start(() => {
		return parseFloat(ranger.value) * 1000;
	});

	playbackBtn.textContent = "Pause";
});

videoTag.addEventListener("pause", () => {
	server.suspend();
	playbackBtn.textContent = "Resume";
});

const presenter = document.getElementById("presenter");

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

videoTag.play();

setTimeout(() => {
	server.addTextChunk(vttChunk, "it");
}, 3000);