import type * as Entities from "./Entities/index.js";
import type { Region } from "./Region.js";
import type { RenderingModifiers } from "./RenderingModifiers.js";

const entitiesSymbol = Symbol("sub37.entities");
const regionSymbol = Symbol("sub37.region");

interface CueProps {
	id: string;
	startTime: number;
	endTime: number;
	content: string;
	renderingModifiers?: RenderingModifiers;
	entities?: Entities.AllEntities[];
	region?: Region;
}

export class CueNode implements CueProps {
	static from(cueNode: CueNode | undefined, data: CueProps): CueNode {
		if (!cueNode) {
			return new CueNode(data);
		}

		const descriptors: PropertyDescriptorMap = {};
		const dataMap = Object.entries(data) as [keyof CueProps, CueProps[keyof CueProps]][];

		for (const [key, value] of dataMap) {
			if (cueNode[key] !== value) {
				descriptors[key] = {
					value,
					writable: true,
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
	private [entitiesSymbol]: Entities.AllEntities[] = [];

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

	public get entities(): Entities.AllEntities[] {
		return this[entitiesSymbol];
	}

	public set entities(value: Entities.AllEntities[]) {
		this[entitiesSymbol] = value;
	}

	public set region(value: Region | undefined) {
		if (value) {
			this[regionSymbol] = value;
		}
	}

	public get region(): Region | undefined {
		return this[regionSymbol];
	}
}
