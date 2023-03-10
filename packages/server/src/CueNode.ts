import type * as Entities from "./Entities";
import type { IntervalBinaryLeaf, Leafable } from "./IntervalBinaryTree";
import type { Region } from "./Region";
import type { RenderingModifiers } from "./RenderingModifiers";

const entitiesSymbol = Symbol("sub37.entities");
const regionSymbol = Symbol("sub37.region");

interface CueProps {
	id: string;
	startTime: number;
	endTime: number;
	content: string;
	renderingModifiers?: RenderingModifiers;
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
	public renderingModifiers?: RenderingModifiers;

	private [regionSymbol]?: Region;
	private [entitiesSymbol]: Entities.GenericEntity[] = [];

	constructor(data: CueProps) {
		this.id = data.id;
		this.startTime = data.startTime;
		this.endTime = data.endTime;
		this.content = data.content;
		this.renderingModifiers = data.renderingModifiers;
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
		 * in captions renderer
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
	return e1.offset <= e2.offset ? -1 : 1;
}
