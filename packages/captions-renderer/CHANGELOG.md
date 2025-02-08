# @sub37/captions-renderer

## **1.1.1** (08 Feb 2025)

**Changes**:

- Refactored entity difference calculation;
- Refactored entity conversion to DOM elements;
- Refactored line creation and entities association;
-

**Bug fix**:

- Fixed [Issue #11](https://github.com/alexandercerutti/sub37/issues/11);

---

## **1.1.0**

**Changes**:

- Changed fallback values for `getOrigin` invokation to be percentages strings;
- Added fallbacks for `getOrigin`'s `originX` and `originY` to be percentages if no unit is specified;
- Changed region `height` to respect the adapter region implementation will with the new `height` property in the Region protocol, when available, and to fallback to the `lines` property;
- Added new Renderer boolean property `roundRegionHeightLineFit` to let `captions-renderer` to slightly override the adapter `height` property, in order to show the next full line, if cut;
- Added new css style variable **--sub37-region-area-bg-color**, to change color to the area covered by `height`. It defaults to `transparent`;
- **Typescript**: exported type `CaptionsRenderer` to reference the component;
- **Tests**: Improved tests structure through fixture;

---

## **1.0.0**

- First version released
