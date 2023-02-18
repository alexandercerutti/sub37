<div align="center">
	<br>
	<br>
	<picture>
		<source media="(prefers-color-scheme: dark)"
			srcset="https://github.com/alexandercerutti/sub37/raw/master/assets/logo-dark.svg?sanitize=true"
		>
		<img
			alt="sub37 logo for light mode"
			src="https://github.com/alexandercerutti/sub37/raw/master/assets/logo-light.svg?sanitize=true"
		>
	</picture>
	<br>
	<br>
</div>

## Introduction

sub37 is set of _dependency-free_ libraries that aims to provide a consistent and customizable media contents captions experience across browsers by leaving, at the same time, the freedom to developers to choose which caption format to support (like WebVTT, TTML, ...) and how to style them.

## Architecture overview

sub37 architecture is made of three components:

- A Renderer (`@sub37/captions-renderer`), a WebComponent that handles all the aspects of captions rendering (styles, colors, positioning, etc.);
- A Server (`@sub37/server`), a library that handles timed serving of cues and centralizes all the shared aspects (formats, communciation);
- An Adapter (e.g. `@sub37/webvtt-adapter`), a library that knows how to parse a specific captions format and knows how to convert it to the core format provided by the server;

Of the three components, both Renderer and Adapter are replaceable: they only need to provide the correct support to the interface that server expects to use to communicate with them (see the wiki).

At this early stage, sub37 provides only the webvtt-adapter to be used. Further formats will be implemented and evaluated over the time.

## Installation

Once chosen the adapters suitable for your use case, proceed to install all the packages needed.

```sh
$ npm install @sub37/server @sub37/captions-renderer @sub37/webvtt-adapter
```

## API Documentation Reference

Each component has its own README and Wiki Page that provides more details on how they should be used and which features they support.

More details about usage and architecture can be found in the wiki (_coming soon_).

## Usage example

In your HTML, include the `captions-renderer`. This element is studied to be put over `HTMLVideoElement`s.

```html
<div id="video-container">
	<captions-renderer />
	<video src="...">
</div>
```

In your Javascript, load the caption-renderer by importing it as a side-effect. This will load it into your window's customElements Registry.

Create an instance of the server and pass it the Renderers you want to import. The renderers will be available as long as you keep your Server instance.

Attach `caption-renderer` to server instance event system. Then create a session and pass it a set of tracks. Each track represents a content to be associated and parsed through your adapters.
As parsing is a synchronous activity, once it is completed, you'll be able to call `.start` to start serving the content.

```javascript
import "@sub37/captions-renderer";
import { Server, Events } from "@sub37/server";
import { WebVTTAdapter } from "@sub37/webvtt-adatpter";

const videoElement = document.getElementsByTagName("video")[0];
const rendererElement = document.getElementsByTagName("captions-renderer")[0];
const captionServer = new Server([WebVTTAdapter]);

captionServer.addEventListener(Events.CUE_START, presenter.setCue);
captionServer.addEventListener(Events.CUE_STOP, presenter.setCue);

captionServer.createSession([
	{
		lang: "ita",
		content: "WEBVTT ...",
		mimeType: `text/vtt`;
		active: true;
	}
]);

captionServer.start(() => {
	return videoElement.currentTime;
});

videoElement.play();
```

## Other

This project was born by a personal need while working on the on-demand video player of a big Italian 🇮🇹 television broadcaster. It took over a year to become ready.

Its name is a reference to an Italian television teletext service, called "televideo". It was common to hear, before the beginning of programs, a voice telling "subtitles available at 777 of televideo". From there, `sub37`.
