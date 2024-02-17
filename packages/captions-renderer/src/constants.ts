export const CSSVAR_TEXT_COLOR = "--sub37-text-color" as const;
export const CSSVAR_TEXT_BG_COLOR = "--sub37-text-bg-color" as const;

/**
 * The background of a region is the amount of
 * lines that are shown in a specific moment.
 *
 * Maybe the name is not the best of all. In fact,
 * we might decide to give it to the variable below
 * and rename this. But this would be a breaking change.
 */

export const CSSVAR_REGION_BG_COLOR = "--sub37-region-bg-color" as const;

/**
 * The area of the region is composed of its full height,
 * which, if not specified by the renderer, fallbacks to the
 * max amount of lines that should be shown.
 */

export const CSSVAR_REGION_AREA_BG_COLOR = "--sub37-region-area-bg-color" as const;
export const CSSVAR_BOTTOM_SPACING = "--sub37-bottom-spacing" as const;
export const CSSVAR_BOTTOM_TRANSITION = "--sub37-bottom-transition" as const;
