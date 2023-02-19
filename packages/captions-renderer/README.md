# @sub37/captions-renderer

This is the main element that handles captions rendering and allows styiling them with custom CSS properties (described below).
All the areas in which subtitles get rendered are considered as regions to achieve a uniformed behavior.

## Importing

The minimum requirement to make `@sub37/captions-renderer` usable is to import it as a side-effect. Importing it like this, will make `captions-renderer` to be registered onto window's custom elements registry.

```typescript
import "@sub37/captions-renderer`;
```

It also exposes some properties that might require you to import them as classicly. For example:

```typescript
import type { OrchestratorSettings } from "@sub37/captions-renderer";
import { CSSVAR_TEXT_COLOR, ... } from "@sub37/captions-renderer";
```

## Rendering behaviors

Captions are known to have three types of behaviors when they get rendered. This is regardless of using `@sub27/captions-renderer`.

- `Pop-on`
- `Roll-up`
- `Paint-on`

Each of these is supported by `captions-renderer`, but it is not the only responsible for them to happen. Continue reading to understand how they can be obtained.

### Pop-on

**Pop-on** mode is the most classic rendering mode: captions gets rendered and remain visible for the track's pre-established amount of time. Then they get removed to leave place to other cues.

This behavior is automatically supported by `captions-renderer`.

### Roll-up

**Roll-up** mode was popular in old television subtitles and it is deployed today in captions like Youtube's.
It consists into painting the whole line and, once the available space ends, push the whole line up to leave space to another line. Once the available region space is reached (tipically 2 or 3 lines), older lines gets hidden.

Cues following roll-up, could be splitted into different regions that proceed distinctly. This might be useful to represent some dialogs.

`captions-renderer` supports this behavior by default. Cues are splitted by words to allow it to determine how many lines should be occupied by each cue.

### Paint-on

**Paint-on** is one of the most interesting rendering mode, as it goes hand in hand with the previous two modes, especially **roll-up**. It consists into rendering each word with a different time from the previous or the next one.

This might be useful to obtain a speaker-like effect.

`captions-renderer` supports this by default, but to achieve the timing, tracks, adapters implementation and subtitle format **must support this**.

For example, WebVTT standard supports [`timestamps`](https://www.w3.org/TR/webvtt1/#webvtt-cue-timestamp), which allow words to be splitted inside the tracks. Then, `@sub37/webvtt-adapter` supports parsing and normalization of these timestamps.

---

## Properties

Some properties are available to customize the rendering experience. These properties should be considered as defaults replacements, but might be ignored if provided tracks have such properties.

These properties can be set like follows:

```javascript
const renderer = document.getElementsByTagName("captions-renderer")[0];

renderer.setRegionProperties({ ... });
```

These properties are described into an exposed typescript interface:

```typescript
import type { OrchestratorSettings } from "@sub37/captions-renderer";
```

### Supported Properties

| Property name        | Default | Description                                                                                                                                              |
| -------------------- | :-----: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines`              |   `2`   | The maximum amount of lines that should be rendered by this element before hiding the previous lines. Is overridden by tracks' regions `lines` property. |
| `shiftDownFirstLine` | `false` | Allows obtaining a Youtube-like effect, where the first line is shifted down if no other lines are available to be showed.                               |

## Custom CSS variables

```typescript
import { CSSVAR_TEXT_COLOR, ... } from "@sub37/captions-renderer";
```

| CSS Variable Name           |  Javascript Constant Name  |      Default      | Description                                                                                                                                      |
| :-------------------------- | :------------------------: | :---------------: | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--sub37-text-color`        |    `CSSVAR_TEXT_COLOR`     |      `#FFF`       | Allows changing the color of text. This text overrides the color harcoded into provided tracks                                                   |
| `--sub37-text-bg-color`     |   `CSSVAR_TEXT_BG_COLOR`   | `rgba(0,0,0,0.7)` | This is the background color. Set to `transparent` to remove it.                                                                                 |
| `--sub37-region-bg-color`   |  `CSSVAR_REGION_BG_COLOR`  | `rgba(0,0,0,0.4)` | This is the background color of the regions. Set to `transparent` to remove it.                                                                  |
| `--sub37-bottom-spacing`    |  `CSSVAR_BOTTOM_SPACING`   |       `0px`       | This is the amount of space that regions should leave from bottom. This might be useful to make the regions move, for example, to show controls. |
| `--sub37-bottom-transition` | `CSSVAR_BOTTOM_TRANSITION` |    `0s linear`    | This is the `transition` proprieties that can be applied to regions when `--sub37-bottom-spacing` gets changed. Make it smoooooth, baby!         |

## Testing

This package uses the sub37 sample page (`packages/sample/pages/sub37-example`) to run the tests.
Playwright automatically navigates starts the server and navigates there.

Assuming that dependencies have been already installed, to run tests, run the following command:

```sh
$ npm test
```
