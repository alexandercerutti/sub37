import { GenericEntity, Type } from "./Generic.js";

export class Style extends GenericEntity {
	public styles: { [key: string]: string | number } | string /** @TODO choose one of the two */;

	public constructor(params: {
		offset: number;
		length: number;
		styles: { [key: string]: string | number } | string /** @TODO choose one of the two */;
	}) {
		super(Type.STYLE, params.offset, params.length);

		this.styles = params.styles;
	}
}
