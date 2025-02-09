import { type EntityProtocol, Type } from "./index.js";

export interface LocalStyleEntity extends EntityProtocol {
	readonly type: Type.LOCAL_STYLE;
	readonly styles: Record<string, string>;
}

export function createLocalStyleEntity(stylesSource: string | Record<string, string>): LocalStyleEntity {
	const styles = getKeyValueFromCSSRawDeclarations(stylesSource);

	return {
		type: Type.LOCAL_STYLE,
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

export function isLocalStyleEntity(entity: EntityProtocol): entity is LocalStyleEntity {
	return entity.type === Type.LOCAL_STYLE;
}
