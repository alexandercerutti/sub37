import { TagType } from "@hsubs/server";

export const EntitiesTokenMap: { [key: string]: TagType } = {
	b: TagType.BOLD,
	c: TagType.CLASS,
	i: TagType.ITALIC,
	lang: TagType.LANG,
	rt: TagType.RT,
	ruby: TagType.RUBY,
	u: TagType.UNDERLINE,
	v: TagType.VOICE,
};
