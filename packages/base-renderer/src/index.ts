import type { CueNode } from "@hsubs/server";

export interface HSBaseRendererConstructor<T> {
	supportedType: string;
	new (): HSBaseRenderer<T>;
}

export interface HSBaseRenderer<R> {
	parse(rawContent: R): CueNode[];
}
