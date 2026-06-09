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
