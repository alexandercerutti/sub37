import type { Token } from "./Token";
import { memoizationFactory } from "./memoizationFactory";

export interface TTMLStyle {
	id: string;
	attributes: Record<string, string>;
}

export const createStyleParser = memoizationFactory(function styleParserExecutor(
	/**
	 * @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#style-attribute-style
	 * @see https://www.w3.org/TR/xmlschema-2/#IDREFS
	 */
	stylesIDREFSStorage: Map<string, TTMLStyle>,
	token: Token,
): TTMLStyle | undefined {
	if (token.content !== "style") {
		return undefined;
	}

	let styleCache: Record<string, string> | undefined = undefined;

	const { attributes } = token;

	const id = attributes["xml:id"] || `style-rdm:${Math.floor(Math.random() * 1000)}`;
	const attrs = excludeUnsupportedStyleAttributes(attributes);

	if (!Object.keys(attrs).length) {
		return undefined;
	}

	if (!attributes["style"]) {
		styleCache = attrs;
	}

	const style = {
		id: resolveIDREFConflict(stylesIDREFSStorage, id),
		get attributes(): TTMLStyle["attributes"] {
			if (typeof styleCache !== "undefined") {
				return styleCache;
			}

			const parentStyle = stylesIDREFSStorage.get(attributes["style"]);

			if (!parentStyle) {
				styleCache = attrs;
				return styleCache;
			}

			styleCache = Object.create(attrs);

			for (const [styleName, value] of Object.entries(parentStyle.attributes)) {
				styleCache[styleName] = value;
			}

			return styleCache;
		},
	};

	/** @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-style-association-chained-referential */
	stylesIDREFSStorage.set(id, style);

	return style;
});

function excludeUnsupportedStyleAttributes(
	attributes: Record<string, string>,
): Record<string, string> {
	const attrs: Record<string, string> = {};

	for (let attr in attributes) {
		if (!attr.startsWith("tts:")) {
			continue;
		}

		attrs[attr] = attributes[attr].replace("tts:", "");
	}

	return attrs;
}

function resolveIDREFConflict(idrefsMap: Map<string, TTMLStyle>, id: string): string {
	if (!idrefsMap.has(id)) {
		return id;
	}

	let styleConflictOverrideIdentifier = parseInt(id.match(/--(\d{1,})/)?.[1]);

	if (Number.isNaN(styleConflictOverrideIdentifier)) {
		return id;
	}

	while (idrefsMap.has(`${id}--${styleConflictOverrideIdentifier}`)) {
		styleConflictOverrideIdentifier++;
	}

	return id.replace(
		`--${styleConflictOverrideIdentifier}`,
		`--${styleConflictOverrideIdentifier + 1}`,
	);
}
