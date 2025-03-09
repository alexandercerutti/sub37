import { type EntityProtocol, Type } from "./index.js";

/**
 * Line style is equivalent to LocalStyle,
 * but it helps us to differentiate where
 * to assign styles
 */

export interface LineStyleEntity extends EntityProtocol {
	readonly type: Type.LINE_STYLE;
	readonly styles: Record<string, string>;
}

export function createLineStyleEntity(stylesSource: string | Record<string, string>): LineStyleEntity {
	const styles = getKeyValueFromCSSRawDeclarations(stylesSource);

	return {
		type: Type.LINE_STYLE,
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

export function isLineStyleEntity(entity: EntityProtocol): entity is LineStyleEntity {
	return entity.type === Type.LINE_STYLE;
}
