# Sub37

Pluggable captions engine

## Introduction

sub37 is set of _dependency-free_ libraries that aims to provide a consistent and customizable contents captioning experience on media contents across browsers by leaving, at the same time, the freedom to developers to choose which caption format to support (like WebVTT).

## Architecture

sub37 architecture is made of three components:

- A Renderer (`@sub37/captions-renderer`), a WebComponent that handles all the aspects of captions rendering (styles, colors, positioning, etc.);
- A Server (`@sub37/server`), a library that handles timed serving of cues and centralizes all the shared aspects (formats, communciation);
- An Adapter (e.g. `@sub37/webvtt-adapter`), a library that knows how to parse a specific captions format and knows how to convert it to the core format provided by the server;

Of the three components, both Renderer and Adapter are replaceable: they only need to provide the correct support to the interface that server expects to use to communicate with them (see the wiki).

At this early stage, sub37 provides only the webvtt-adapter to be used. Further formats will be implemented and evaluated over the time.

## API Documentation Reference

Each component has its own README and Wiki Page that provides more details on how they should be used and which features they support.

More details about usage and architecture can be found in the wiki (_coming soon_).

## Other

This project was born by a personal need while working on the on-demand video player of a big Italian 🇮🇹 television broadcaster. It took over a year to become ready.

Its name is a reference to the Italian television teletext service, called "televideo". It was common to hear, before the beginning of programs, a voice telling "subtitles available at 777 of televideo". From there, `sub37`.
