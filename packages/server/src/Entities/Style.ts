import { GenericEntity, Type } from "./Generic.js";

export class Style extends GenericEntity {
	public styles: Record<string, string> = {};

	public constructor(styles: string | Record<string, string>) {
		super(Type.STYLE);

		if (typeof styles === "string") {
			const declarations = getKeyValueFromCSSRawDeclarations(styles);
			Object.assign(this.styles, declarations);
		} else if (typeof styles === "object" && styles) {
			Object.assign(this.styles, styles);
		}
	}
}

function getKeyValueFromCSSRawDeclarations(declarationsRaw: string | object): object {
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
