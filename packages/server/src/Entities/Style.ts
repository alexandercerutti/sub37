import { type EntityProtocol, Type } from "./index.js";

export interface StyleEntity extends EntityProtocol {
	type: Type.STYLE;
	styles: Record<string, string>;
}

export function createStyleEntity(stylesSource: string | Record<string, string>): StyleEntity {
	const styles = getKeyValueFromCSSRawDeclarations(stylesSource);

	return {
		type: Type.STYLE,
		styles,
	};
}

function getKeyValueFromCSSRawDeclarations(
	declarationsRaw: string | Record<string, string>,
): Record<string, string> {
	if (typeof declarationsRaw !== "string" && typeof declarationsRaw !== "object") {
		return {};
	}

	if (typeof declarationsRaw === "object") {
		return declarationsRaw;
	}

	const stylesObject: { [key: string]: string } = {};
	const declarations = declarationsRaw.split(/\s*;\s*/);

	for (const declaration of declarations) {
		if (!declaration.length) {
			continue;
		}

		const [key, value] = declaration.split(/\s*:\s*/);
		stylesObject[key] = value;
	}

	return stylesObject;
}
