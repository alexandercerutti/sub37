# @sub37/server

This is the core package, where magic happens.

Its role it to make common interfaces for adapters and renderers available and keep the tracks for cues distribution session (when a content starts).

## What you need to know

Before start using `sub37`, you need to know the following aspects:

1. Which formats of subtitles are you going to support
2. Where to get and how to get the tracks you want to show
3. Need to know if your raw tracks need some kind of conversion
4. Need to know how to connect it with the player states

`sub37` doesn't perform any kind of conversion of your tracks before sending them to the adapters. It is suggested to ensure yourself that tracks are, if a text, in UTF-8.

## Importing

`server` exposes a class that will let you associate the renderers you might want to use.

```typescript
import { Server, Events, Errors } from "@sub37/server";

const server = new Server(...adapters);
```

Provided adapters will be available as long as a Server instance is available.

## Starting a new session

Server works with sessions. Once the instance is created, it will be possible to create and start a distribution session.

A session is described by the tracks that get specified. User will have to specify them with the following properties:

```typescript
interface TrackRecord {
	lang: string /** arbitrary language id */;
	content: unknown;
	mimeType: `${string}/${string}`;
	active?: boolean;
}

server.createSession([
	{
		lang: "ita",
		content: "WEBVTT ...",
		mimeType: `text/vtt`,
		active: true;
	},
	...
]);
```

By default **no track is considered active** if not determined with the `active` parameter. Not specifying an active track and starting the server, might cause an `ActiveTrackMissingError` when attempting to start the server.

Once created the session, you can `start` it. In order to be synchronized with your video element, when starting the session, `server` requires you to specify a callback that will get invoked at every check (a "tick"; every tick happens once an amount of time, specified by the second parameter, passes). That callback is expected to return the current position.

Tick's default time is `250ms`.

```typescript
server.start(() => {
	return myVideoElement.currentTime;
}, 300);
```

Attempting to start a server before creating a `session`, will cause a `SessionNotInitializedError` to be fired.

## Changing server states

Server can be paused buy using the `.suspend()` method and resumed by using the method `.resume()`.

When server is suspended, the callback passed to `start` will stop being invoked. Therefore, if a seek happens, subtitles won't be updated.

To prevent this issue, there's a method that can be called only when the server is suspended: `.updateTime`. It accepts an amount of time in milliseconds as a parameter.

Using it, the server will perform an update of cues and send them to the renderer.

```typescript
videoElement.addEventListener("pause", () => {
	if (server.isRunning) {
		server.suspend();
	}
});

videoElement.addEventListener("playing", () => {
	if (!server.isRunning) {
		server.resume();
	}
});

videoElement.addEventListener("seeking", () => {
	server.updateTime(videoElement.currentTime * 1000);
});

videoElement.pause();
videoElement.currentTime = 12; /** seconds **/
```

## Attaching a renderer

// TODO

## Error handling

All `sub37` are studied to be as safe as possible and with parlant errors when they get thrown. All errors exposed, can be used through the `Errors` namespace imported as above.

```typescript
try {
	...
} catch (err) {
	if (err instance of Errors.ParsingError) {
		/** do something */
	}
}
```

These are the errors that might get fired. Some might just get logged in console. Others might get fired when attempting to use methods.

| Error class name                          | When happens                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ActiveTrackMissingError`                 | When `server` is started but, of the provided ones, no track has been set as active.                                                             |
| `AdapterNotExtendingPrototypeError`       | When a provided adapter doesn't respect prototype requirements.                                                                                  |
| `AdapterNotOverridingSupportedTypesError` | When a provided adapter doesn't specify which mimeType it supports. Hence, it cannot be used.                                                    |
| `AdapterNotOverridingToStringError`       | When a provided adapter doesn't specify it's name.                                                                                               |
| `AdaptersMissingError`                    | When Server didn't receive any adapter when the instance gets created.                                                                           |
| `NoAdaptersFoundError`                    | When none of the provided adapters satisfy the requirements, so none can be used.                                                                |
| `OutOfRangeFrequencyError`                | When creating a server, the `frequency` parameter is not a number or is lower than 1 or is falsy                                                 |
| `ParsingError`                            | When an adapter crashed or throw a critical error. It is not possible to go on. Will wrap other errors.                                          |
| `SessionNotInitializedError`              | When an operation expects a session to have already been created through `createSession`, but it wasn't.                                         |
| `SessionNotStartedError`                  | When an operation expects a session to have already been started through `start` but it wasn't.                                                  |
| `ServerAlreadyRunningError`               | When an operation expects a session to be paused before continuing.                                                                              |
| `ServerNotRunningError`                   | When an operation expects a session to be running before continuing.                                                                             |
| `UncaughtParsingExceptionError`           | An unknown blocking error happened inside an adapter while attempting to parse.                                                                  |
| `UnexpectedDataFormatError`               | An adapter didn't return the expected format for a cue. The cue gets ignored.                                                                    |
| `UnexpectedParsingOutputFormatError`      | When an adapter didn't return the expected data structure when it ended the parsing phase. Data cannot be read an it is not possible to proceed. |
| `UnparsableContentError`                  | The chosen adapter wasn't able to parse the provided content. Something is wrong here, either the adapter support or the track format.           |
| `UnsupportedContentError`                 | When looking for a suitable Adapter, Server wasn't able to find an adapter that matches content's mimetype with adapters `supportedTypes`.       |
