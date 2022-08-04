import type { TagType } from "@hsubs/server";
import { EntitiesTokenMap } from "./Tags/tokenEntities";

const CSS_RULESET_REGEX = /::cue(?:\((.+)\))?\s*\{\s*([\s\S]+)\}/;

/**
 * Matching of `lang[voice="Esme"]` both 'lang' or 'voice' + 'Esme'
 */

const CSS_SELECTOR_ATTRIBUTES_REGEX = /([^\[\]]+)|\[(.+?)(?:="(.+?)?")?\]/g;

const CODEPOINT_ESCAPE_REPLACE_REGEX = /\\3(\d)\s+(\d+)/;

export const enum StyleTarget {
	GLOBAL,
	ID,
	TAG,
}

type SelectorTarget =
	| { type: StyleTarget.GLOBAL }
	| { type: StyleTarget.ID; selector: string }
	| { type: StyleTarget.TAG; selector: TagType; attributes: string[][] };

export type Style = SelectorTarget & {
	styleString: string;
};

export function parseStyle(rawStyleData: string): Style | undefined {
	const styleBlockComponents = rawStyleData.match(CSS_RULESET_REGEX);

	if (!styleBlockComponents) {
		return undefined;
	}

	const [, selector, cssData] = styleBlockComponents;

	const normalizedCssData = normalizeCssString(cssData.trim());

	if (!normalizedCssData.length) {
		return undefined;
	}

	const parsedSelector = getParsedSelector(selector);

	if (!parsedSelector) {
		return undefined;
	}

	return {
		...parsedSelector,
		styleString: normalizedCssData,
	};
}

function getParsedSelector(selector: string): SelectorTarget | undefined {
	if (!selector) {
		return {
			type: StyleTarget.GLOBAL,
		};
	}

	if (selector.startsWith("#")) {
		return {
			type: StyleTarget.ID,
			selector: stripEscapedCodePoint(selector.slice(1)).replace("\\", ""),
		};
	}

	const selectorComponents = getSelectorComponents(selector);

	if (!selectorComponents.selector) {
		/** Invalid */
		return undefined;
	}

	return {
		type: StyleTarget.TAG,
		...selectorComponents,
	};
}

function getSelectorComponents(rawSelector: string): { selector: TagType; attributes: string[][] } {
	let selector: string = undefined;
	const attributes: string[][] = [];

	/**
	 * This is too recent and will likely require a polyfill from
	 * users. But it fulfill a requirement when matching things with regex.
	 */

	const matchIterator = rawSelector.matchAll(CSS_SELECTOR_ATTRIBUTES_REGEX);

	for (const [, tag = selector, attribute, value] of matchIterator) {
		selector = tag;

		if (attribute && value) {
			attributes.push([attribute, value]);
		}
	}

	return {
		selector: EntitiesTokenMap[selector],
		attributes,
	};
}

function normalizeCssString(cssData: string = "") {
	return cssData
		.replace(/\/\*.+\*\//, "") /** CSS inline Comments */
		.replace(/\s+/g, "\x20") /** Multiple whitespaces */
		.trim();
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
