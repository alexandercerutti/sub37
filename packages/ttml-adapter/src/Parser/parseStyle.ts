import type { Token } from "./Token";

export interface TTMLStyle {
	id: string;
	attributes: Record<string, string>;
}

export function parseStyle(token: Token): TTMLStyle {
	const { attributes } = token;

	const id = attributes["xml:id"];
	const attrs = excludeUnsupportedStyleAttributes(attributes);

	return {
		id,
		attributes: attrs,
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
