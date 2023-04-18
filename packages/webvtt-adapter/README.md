# @sub37/webvtt-adapter

As its name says, this adapter handles whatever concerns the parsing, the tokenization and hence the conversion of a WebVTT text track so that it can be used by `@sub37/*`.

It tries to adhere as much as possible to the standard, leaving out or manipulating some concepts regarding the rendering of cues (which must be accomplished along with `@sub37/captions-renderer`).

### Supported features

Here below a list of features that other platforms do not or partially support:

- **Timestamps** to show timed text within the same cue (right now this is not supported by browsers even if part of the standard);
- **Regions** (not very well supported by Firefox, but supported in Chromium);
- **Positioning** attributes (like `position: 30%,line-left`, supported by Firefox but not supported by Chromium);

### Manipulated concepts or missing features

- `lines`: as one of the core principles of `@sub37/captions-renderer` is to collect everything into regions, the line amount is to be intended of how many lines the region will show before hiding older lines;
- `snapToLines`: this is not supported, cause of `lines`
- `::past / ::future`: not yet supported. Might require deep changes, but they haven't been evaluated yet;
- `::cue-region`: as above;
- Vertical text support is missing yet. Will be introduced soon, as it requires changes also into `@sub37/captions-renderer`.
- [Default CSS Properties](https://www.w3.org/TR/webvtt1/#applying-css-properties) are not supported as they are matter of `@sub37/captions-renderer`;
- [Time-aligned metadata](https://www.w3.org/TR/webvtt1/#introduction-metadata) cues are not supported yet.
