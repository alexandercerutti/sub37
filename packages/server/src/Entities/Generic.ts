export const enum Type {
	STYLE,
	TAG,
}

export class GenericEntity {
	public offset: number;
	public length: number;
	public type: Type;

	public constructor(type: Type, offset: number, length: number) {
		this.offset = offset;
		this.length = length;
		this.type = type;
	}
}
