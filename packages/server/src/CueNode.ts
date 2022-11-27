import type * as Entities from "./Entities";
import type { IntervalBinaryLeaf, Leafable } from "./IntervalBinaryTree.js";
import type { Region } from "./Region";

const entitiesSymbol = Symbol("hs.entities");
const regionSymbol = Symbol("hs.region");

interface CueProps {
	id: string;
	startTime: number;
	endTime: number;
	content: string;

	/** @TODO attributes are generic cue attributes, but we miss a shared format yet */
	attributes?: any;
	entities?: Entities.GenericEntity[];
	region?: Region;
}

export class CueNode implements CueProps, Leafable<CueNode> {
	static from(cueNode: CueNode, data: CueProps): CueNode {
		if (!cueNode) {
			return new CueNode(data);
		}

		const descriptors: PropertyDescriptorMap = {};
		const dataMap = Object.entries(data) as [keyof CueProps, CueProps[keyof CueProps]][];

		for (const [key, value] of dataMap) {
			if (cueNode[key] !== value) {
				descriptors[key] = {
					value,
				};
			}
		}

		return Object.create(cueNode, descriptors);
	}

	public startTime: number;
	public endTime: number;
	public id: string;
	public content: string;
	public attributes?: any;

	public [regionSymbol]?: Region;
	public [entitiesSymbol]: Entities.GenericEntity[] = [];

	constructor(data: CueProps) {
		this.id = data.id;
		this.startTime = data.startTime;
		this.endTime = data.endTime;
		this.content = data.content;
		this.attributes = data.attributes;
		this.region = data.region;

		if (data.entities?.length) {
			this.entities = data.entities;
		}
	}

	public get entities(): Entities.GenericEntity[] {
		return this[entitiesSymbol];
	}

	public set entities(value: Entities.GenericEntity[]) {
		/**
		 * Reordering cues entities for a later reconciliation
		 * in captions presenter
		 */

		this[entitiesSymbol] = value.sort(reorderEntitiesComparisonFn);
	}

	public set region(value: Region) {
		if (value) {
			this[regionSymbol] = value;
		}
	}

	public get region(): Region | undefined {
		return this[regionSymbol];
	}

	/**
	 * Method to convert it to an IntervalBinaryTree
	 * @returns
	 */

	public toLeaf(): IntervalBinaryLeaf<CueNode> {
		return {
			left: null,
			right: null,
			node: this,
			max: this.endTime,
			get low() {
				return this.node.startTime;
			},
			get high() {
				return this.node.endTime;
			},
		};
	}
}

function reorderEntitiesComparisonFn(e1: Entities.GenericEntity, e2: Entities.GenericEntity) {
	return e1.offset <= e2.offset || e1.length <= e2.length ? -1 : 1;
}
