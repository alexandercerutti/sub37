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

	public constructor(params: {
		tagType: TagType;
		attributes: Map<string, string | undefined>;
		classes: Tag["classes"];
	}) {
		super(Type.TAG);

		this.tagType = params.tagType;
		this.attributes = params.attributes;
		this.classes = params.classes || [];
	}
}
