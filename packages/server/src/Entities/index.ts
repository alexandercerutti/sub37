import type { LineStyleEntity } from "./LineStyle.js";
import type { LocalStyleEntity } from "./LocalStyle.js";
import type { TagEntity } from "./Tag.js";
import type { AnimationEntity } from "./Animation.js";

export * from "./Tag.js";
export * from "./LocalStyle.js";
export * from "./LineStyle.js";
export * from "./Animation.js";

export const enum Type {
	LINE_STYLE,
	LOCAL_STYLE,
	TAG,
	ANIMATION,
}

export interface EntityProtocol {
	type: Type;
}

export type AllEntities = LineStyleEntity | LocalStyleEntity | TagEntity | AnimationEntity;
