import { type StyleEntity } from "./Style.js";
import { type TagEntity } from "./Tag.js";

export * from "./Tag.js";
export * from "./Style.js";

export const enum Type {
	STYLE,
	TAG,
}

export interface EntityProtocol {
	type: Type;
}

export type AllEntities = StyleEntity | TagEntity;
