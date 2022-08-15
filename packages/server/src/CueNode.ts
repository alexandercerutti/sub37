import type { IntervalBinaryLeaf, Leafable } from "./IntervalBinaryTree.js";
import type { Entity, Region } from "./model";

const entitiesSymbol = Symbol("hs.entities");
const regionSymbol = Symbol("hs.region");

interface CueProps {
	id: string;
	startTime: number;
	endTime: number;
	content: string;

	/** @TODO attributes are generic cue attributes, but we miss a shared format yet */
	attributes?: any;
	entities?: Entity[];
	region?: Region;
}

export class CueNode implements CueProps, Leafable<CueNode> {
	public startTime: number;
	public endTime: number;
	public id: string;
	public content: string;
	public attributes?: any;

	public [regionSymbol]?: Region;
	public [entitiesSymbol]: Entity[] = [];

	constructor(data: CueProps) {
		this.id = data.id;
		this.startTime = data.startTime;
		this.endTime = data.endTime;
		this.content = data.content;
		this.attributes = data.content;
		this.region = data.region;

		if (data.entities?.length) {
			this.entities = data.entities;
		}
	}

	public get entities(): Entity[] {
		return this[entitiesSymbol];
	}

	public set entities(value: Entity[]) {
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
			get min() {
				return this.node.startTime;
			},
			get max() {
				return this.node.endTime;
			},
		};
	}
}

function reorderEntitiesComparisonFn(e1: Entity, e2: Entity) {
	return e1.offset <= e2.offset || e1.length <= e2.length ? -1 : 1;
}
