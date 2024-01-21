import { Entities } from "@sub37/server";

export const EntitiesTokenMap: { [key: string]: Entities.TagType } = {
	b: Entities.TagType.BOLD,
	c: Entities.TagType.CLASS,
	i: Entities.TagType.ITALIC,
	span: Entities.TagType.SPAN,
	rt: Entities.TagType.RT,
	ruby: Entities.TagType.RUBY,
	u: Entities.TagType.UNDERLINE,
};
