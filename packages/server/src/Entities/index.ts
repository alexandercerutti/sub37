import { type LocalStyleEntity } from "./LocalStyle.js";
import { type TagEntity } from "./Tag.js";

export * from "./Tag.js";
export * from "./LocalStyle.js";

export const enum Type {
	LOCAL_STYLE,
	TAG,
}

export interface EntityProtocol {
	type: Type;
}

export type AllEntities = LocalStyleEntity | TagEntity;
