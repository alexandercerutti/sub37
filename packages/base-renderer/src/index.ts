export interface HSBaseRendererConstructor<T> {
	supportedType: string;
	new (): HSBaseRenderer<T>;
}

export interface HSBaseRenderer<R> {
	convertToEntities(rawContent: R): any /** @TODO Define Entities */;
}
