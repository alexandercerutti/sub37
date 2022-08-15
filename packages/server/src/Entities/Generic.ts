import type { IntervalBinaryLeaf, Leafable } from "../IntervalBinaryTree";

export const enum Type {
	STYLE,
	TAG,
}

export class GenericEntity implements Leafable<GenericEntity> {
	public offset: number;
	public length: number;
	public type: Type;

	public constructor(type: Type, offset: number, length: number) {
		this.offset = offset;
		this.length = length;
		this.type = type;
	}

	public toLeaf(): IntervalBinaryLeaf<GenericEntity> {
		return {
			left: null,
			right: null,
			node: this,
			get max() {
				return this.node.offset + this.node.length;
			},
			get min() {
				return this.node.offset;
			},
		};
	}
}
