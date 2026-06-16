# @sub37/ttml-adapter

This adapter handles parsing of TTML documents (`application/ttml+xml`).

Its sole purpose is transforming the document for presentation — producing Cues and styles output suitable for subtitle rendering. It does not perform conformance validation, profile enforcement, or any processing beyond what is needed for displaying captions and subtitles.

Currently, the adapter targets core TTML2 only and is not designed to be extended for derived profiles (such as EBU-TT-D, IMSC, or SMPTE-TT). An extension mechanism may be introduced in the future to avoid duplicating the base parsing logic across profile-specific adapters.

### Supported features

Beyond the core document structure (`<tt>`, `<body>`, `<div>`, `<p>`, `<span>`, `<br>`), the adapter supports:

- **Three time bases**: `media` (default), `smpte` (including drop-frame arithmetic), and `clock`;
- **Inline and out-of-line animations** via `<animate>` and `<set>`, including `animate` IDREFS on timed elements;
- **Animation metadata**: `keyTimes`, `keySplines`, `repeatCount`, and `fill`;
- **Sequential and parallel time containers** (`timeContainer="seq"` and `"par"`);
- **Inline and out-of-line regions**, with timing and animation support;
- **Style cascade resolution** following the TTML2 order: `<initial>` → referential → nested → inline;
- `xml:lang` is required on `<tt>` and enforced — a missing or empty attribute is a parse error.
- Much more I do not remember...

### Styling

CSS-compatible `tts:*` properties produce direct CSS output. The properties that have been implemented are those that we were certain wouldn't break the `@sub37/caption-renderer` and that have a direct mapping in CSS.

All the properties are recognized by this adapter, but some are therefore ignored.

### Limitations

The following are not yet implemented:

- TTML-specific length units (`c`, `rw`, `rh`) are only partially handled: `c` is converted to `px` for `tts:fontSize` only; other spatial properties receiving these units might produce invalid CSS output;
- Arbitrary namespace prefix rebinding (documents using prefixed elements are silently unparseable);
- `<metadata>` elements (silently ignored, as there is a generic lack of support for non-cues in `@sub37/server`);

### Won't implement

- Embedded resources (`<image>`, `<font>`, `<audio>`, `<data>`, `<chunk>`);
- Audio styling (`tta:` namespace properties);
- 3D stereoscopic offset (`tts:disparity`).
- `ttp:profile` enforcement;

### Errors

All errors produced during parsing are surfaced as `ParseError` objects through the `parse` generator. Non-critical errors are emitted as `CUE_ERROR` events by `@sub37/server` and do not halt parsing. Critical errors stop parsing immediately.

#### Critical

| Error name                      | Trigger                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `MissingContentError`           | The content passed to the adapter is empty                                        |
| `MissingDocumentLanguageError`  | `<tt>` is missing the required `xml:lang` attribute                               |
| `DuplicateDocumentContextError` | A second `<tt>` element is encountered; one document context per track is allowed |

#### Non-critical — time expressions

All of these cause the affected cue or element to be skipped or have its timing ignored.

| Error name                               | Trigger                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `UnsupportedOffsetTimeMetricError`       | An offset-time expression uses a metric other than `h`, `m`, `s`, `ms`, `f`, `t`       |
| `InvalidMediaTimeBaseWallclockTimeUsage` | Wallclock time is used when `ttp:timeBase` is `media`                                  |
| `InvalidSMPTETimeBaseWallClockTimeUsage` | Wallclock time is used when `ttp:timeBase` is `smpte`                                  |
| `InvalidSMPTETimeBaseOffsetTimeUsage`    | Offset time is used when `ttp:timeBase` is `smpte` (deprecated by the standard)        |
| `InvalidClockTimeBaseFramesProvided`     | `frames` or `subframes` fields are used in a clock-time expression                     |
| `NotAllowedClockTimeBaseFrameMetric`     | Frame metric (`f`) is used in an offset-time expression when `ttp:timeBase` is `clock` |

#### Non-critical — animations

All of these cause the affected animation to be skipped. Remaining animations and cues are unaffected.

| Error name                                 | Trigger                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `UnsupportedCalcModeError`                 | `calcMode` has a value other than `discrete`, `linear`, `paced`, or `spline` |
| `KeySplinesRequiredError`                  | `calcMode="spline"` is used but `keySplines` is absent                       |
| `KeySplinesNotAllowedError`                | `keySplines` is present on a non-spline animation                            |
| `KeySplinesInvalidControlsAmountError`     | A spline control does not have exactly 4 coordinates                         |
| `KeySplinesCoordinateOutOfBoundaryError`   | A spline coordinate falls outside `[0, 1]`                                   |
| `KeySplinesAmountNotMatchingKeyTimesError` | The number of splines is not exactly `keyTimes.length − 1`                   |
| `KeyTimesFirstValueNotZeroError`           | The first `keyTimes` value is not `0`                                        |
| `KeyTimesLastValueNotOneError`             | The last `keyTimes` value is not `1`                                         |
| `KeyTimesComponentOutOfBoundaryError`      | A `keyTimes` value falls outside `[0, 1]`                                    |
| `KeyTimesAscendingOrderViolationError`     | `keyTimes` values are not in strictly ascending order                        |
| `KeyTimesInferredMinimumUnmatchedError`    | Fewer than two `keyTimes` values are present                                 |
| `KeyTimesPacedNotAllowedError`             | `keyTimes` is set on a `calcMode="paced"` animation (not allowed)            |

#### Non-critical — styles and document

| Error name / message             | Trigger                                                |
| -------------------------------- | ------------------------------------------------------ |
| `StyleCyclicReferenceError`      | A style references itself or creates a reference cycle |
| `UnsupportedStyleAttributeError` | A `tts:*` attribute is recognized but not implemented  |
