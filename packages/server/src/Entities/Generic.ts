export const enum Type {
	STYLE,
	TAG,
}

export class GenericEntity {
	public type: Type;

	public constructor(type: Type) {
		this.type = type;
	}
}
