import { MalformedStyleBlockError } from "../MalformedStyleBlockError.js";
import { InvalidStyleDeclarationError } from "../InvalidStyleDeclarationError.js";

const CSS_RULESET_REGEX = /::cue(?:\(([^.]*?)(?:\.(.+))*\))?\s*\{\s*([\s\S]+)\}/;

/**
 * Matching of `lang[voice="Esme"]` both 'lang' or 'voice' + 'Esme'
 */

const CSS_SELECTOR_ATTRIBUTES_REGEX = /([^\[\]]+)|\[(.+?)(?:="(.+?)?")?\]/g;

const CODEPOINT_ESCAPE_REPLACE_REGEX = /\\3(\d)\s+(\d+)/;

export const enum StyleDomain {
	GLOBAL,
	ID,
	TAG,
}

type SelectorTarget =
	| { type: StyleDomain.GLOBAL }
	| { type: StyleDomain.ID; selector: string }
	| {
			type: StyleDomain.TAG;
			tagName: string;
			classes: string[];
			attributes: Map<string, string>;
	  };

export type Style = SelectorTarget & {
	styleString: string;
};

/**
 * @see https://www.w3.org/TR/webvtt1/#the-cue-pseudo-element
 */

const WEBVTT_CSS_SUPPORTED_PROPERTIES = [
	"color",
	"opacity",
	"visibility",
	"text-shadow",
	"white-space",
	"text-combine-upright",
	"ruby-position",

	"text-decoration",
	"text-decoration-color",
	"text-decoration-line",
	"text-decoration-style",
	"text-decoration-thickness",

	"background",
	"background-color",
	"background-image",

	"outline",
	"outline-color",
	"outline-style",
	"outline-width",

	"font-family",
	"font-size",
	"font-stretch",
	"font-style",
	"font-variant",
	"font-weight",
	/**
	 * Line-height have been excluded because it might cause issues with
	 * the renderer as it has its own line-height property
	 */
	// "line-height",
];

export function parseStyle(rawStyleData: string): Style | undefined {
	if (!rawStyleData) {
		throw new MalformedStyleBlockError();
	}

	const styleBlockComponents = rawStyleData.match(CSS_RULESET_REGEX);

	if (!styleBlockComponents) {
		throw new InvalidStyleDeclarationError();
	}

	const [, selector, classesChain = "", cssData] = styleBlockComponents;

	const normalizedCssData = normalizeCssString(cssData.trim());

	if (!normalizedCssData.length) {
		return undefined;
	}

	const styleString = filterUnsupportedStandardProperties(normalizedCssData);

	if (!styleString.length) {
		return undefined;
	}

	const parsedSelector = getParsedSelector(selector, classesChain);

	if (!parsedSelector) {
		return undefined;
	}

	return {
		...parsedSelector,
		styleString,
	};
}

function getParsedSelector(selector: string, classesChain: string): SelectorTarget | undefined {
	if (!selector && !classesChain.length) {
		return {
			type: StyleDomain.GLOBAL,
		};
	}

	if (selector.startsWith("#")) {
		return {
			type: StyleDomain.ID,
			selector: stripEscapedCodePoint(selector.slice(1)).replace("\\", ""),
		};
	}

	const selectorComponents = getSelectorComponents(selector);

	if (!selectorComponents.tagName && !selectorComponents.attributes.size && !classesChain.length) {
		/** Invalid */
		return undefined;
	}

	return {
		type: StyleDomain.TAG,
		classes: (classesChain.length && classesChain.split(".")) || [],
		...selectorComponents,
	};
}

const SUPPORTED_STYLABLE_TAG_SELECTORS = ["b", "i", "u", "v", "lang", "c", "ruby", "rt"] as const;

function getSelectorComponents(
	rawSelector: string,
): Omit<SelectorTarget & { type: StyleDomain.TAG }, "type" | "classes"> {
	let selector: string = undefined;
	const attributes: [string, string][] = [];

	/**
	 * This is too recent and will likely require a polyfill from
	 * users. But it fulfill a requirement when matching things with regex.
	 */

	const matchIterator = rawSelector.matchAll(CSS_SELECTOR_ATTRIBUTES_REGEX);

	for (const [, tag = selector, attribute, value] of matchIterator) {
		selector = tag;

		if (attribute) {
			attributes.push([attribute, value || "*"]);
		}
	}

	return {
		tagName: isSelectorSupported(selector) ? selector : undefined,
		attributes: new Map(attributes),
	};
}

function isSelectorSupported(
	selector: string,
): selector is (typeof SUPPORTED_STYLABLE_TAG_SELECTORS)[number] {
	return SUPPORTED_STYLABLE_TAG_SELECTORS.includes(
		selector as (typeof SUPPORTED_STYLABLE_TAG_SELECTORS)[number],
	);
}

function normalizeCssString(cssData: string = "") {
	return cssData
		.replace(/\/\*.+\*\//, "") /** CSS inline Comments */
		.replace(/\s+/g, "\x20") /** Multiple whitespaces */
		.trim();
}

/**
 * Recomposes the style string by filtering out the unsupported
 * WebVTT properties
 *
 * @param styleString
 * @returns
 */

function filterUnsupportedStandardProperties(styleString: string) {
	let finalStyleString = "";
	let startCursor = 0;
	let endCursor = 0;

	while (endCursor <= styleString.length) {
		if (styleString[endCursor] === ";" || endCursor === styleString.length) {
			const parsed = styleString.slice(startCursor, endCursor + 1).split(/\s*:\s*/);
			const property = parsed[0].trim();
			const value = parsed[1].trim();

			if (property.length && value.length && WEBVTT_CSS_SUPPORTED_PROPERTIES.includes(property)) {
				finalStyleString += `${property}:${value}`;
			}

			/** Clearning up an restarting */
			startCursor = endCursor + 1;
			endCursor++;
		}

		endCursor++;
	}

	return finalStyleString;
}

/**
 * CSS specs require selectors to start with a character in
 * ['ASCII upper alpha' - 'ASCII lower alpha'] code points range or an
 * escaped character.
 *
 * If we have a CSS ID which is '123', it is written like "\31 23",
 * where the space is needed to represent the entity and to not select
 * a different character (\3123 would be a different character).
 *
 * Since ASCII Digits starts go from U+0030 (0) to U+0039 (9), we can
 * safely strip it.
 *
 * Right now we are supporting only numbers but other character might
 * get supported in the future.
 *
 *
 * @param string
 * @see https://w3c.github.io/webvtt/#introduction-other-features
 * @see https://infra.spec.whatwg.org/#code-points
 * @see https://www.w3.org/International/questions/qa-escapes#css_identifiers
 * @see https://github.com/chromium/chromium/blob/924ec189cdfd33c8cee15d918f927afcb88d06db/third_party/blink/renderer/core/css/parser/css_parser_idioms.cc#L24-L52
 */

function stripEscapedCodePoint(string: string) {
	return string.replace(CODEPOINT_ESCAPE_REPLACE_REGEX, "$1$2");
}
