export interface HSBaseRendererConstructor {
	supportedType: string;
	new (): HSBaseRenderer;
}

export interface HSBaseRenderer {}
