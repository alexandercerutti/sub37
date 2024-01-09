import { GenericEntity, Type } from "./Generic.js";

/**
 * TagType is an enum containing
 * recognized types in adapters
 * like vtt
 *
 * @TODO this enum should not include WebVTT-only element
 * like class, voice and lang
 */

export enum TagType {
	SPAN /********/ = "span",
	VOICE /*******/ = "v",
	LANG /********/ = "lang",
	RUBY /********/ = "ruby",
	RT /**********/ = "rt",
	CLASS /*******/ = "c",
	BOLD /********/ = "b",
	ITALIC /******/ = "i",
	UNDERLINE /***/ = "u",
}

export class Tag extends GenericEntity {
	public tagType: TagType;
	public attributes: Map<string, string | undefined>;
	public classes: string[];
	public styles?: { [key: string]: string };

	public constructor(params: {
		tagType: TagType;
		attributes: Map<string, string | undefined>;
		styles?: Tag["styles"];
		classes: Tag["classes"];
	}) {
		super(Type.TAG);

		this.tagType = params.tagType;
		this.attributes = params.attributes;
		this.styles = params.styles || {};
		this.classes = params.classes || [];
	}

	public setStyles(styles: string | Tag["styles"]): void {
		const declarations = getKeyValueFromCSSRawDeclarations(styles);
		Object.assign(this.styles, declarations);
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
