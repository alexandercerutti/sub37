import type { Token } from "./Token";

export interface TTMLStyle {
	id: string;
	attributes: Record<string, string>;
}

export function parseStyleFactory(): (token: Token) => TTMLStyle | undefined {
	const stylesIDREFSMap = new Map<string, TTMLStyle>([]);

	return function parseStyle(token: Token): TTMLStyle | undefined {
		if (token.content !== "style") {
			return undefined;
		}

		let styleCache: Record<string, string> | undefined = undefined;

		const { attributes } = token;

		const id = attributes["xml:id"];
		const attrs = excludeUnsupportedStyleAttributes(attributes);

		if (!attributes["style"]) {
			styleCache = attrs;
		}

		const style = resolveIDREFConflict(stylesIDREFSMap, {
			id,
			get attributes(): TTMLStyle["attributes"] {
				if (typeof styleCache !== "undefined") {
					return styleCache;
				}

				const parentStyle = stylesIDREFSMap.get(attributes["style"]);

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
		});

		/** @see https://www.w3.org/TR/2018/REC-ttml2-20181108/#semantics-style-association-chained-referential */
		stylesIDREFSMap.set(id, style);

		return style;
	};
}

export function excludeUnsupportedStyleAttributes(
	attributes: Record<string, string>,
): Record<string, string> {
	const attrs: Record<string, string> = {};

	for (let attr in attributes) {
		if (attr.startsWith("xml:")) {
			continue;
		}

		if (attr === "condition") {
			continue;
		}

		attrs[attr] = attributes[attr].replace("tts:", "");
	}

	return attrs;
}

function resolveIDREFConflict(idrefsMap: Map<string, TTMLStyle>, style: TTMLStyle): TTMLStyle {
	if (!idrefsMap.has(style.id)) {
		return style;
	}

	let styleConflictOverrideIdentifier = parseInt(style.id.match(/--(\d{1,})/)?.[1]);

	if (Number.isNaN(styleConflictOverrideIdentifier)) {
		return style;
	}

	while (idrefsMap.has(`${style.id}--${styleConflictOverrideIdentifier}`)) {
		styleConflictOverrideIdentifier++;
	}

	style.id = style.id.replace(
		`--${styleConflictOverrideIdentifier}`,
		`--${styleConflictOverrideIdentifier + 1}`,
	);

	return style;
}
