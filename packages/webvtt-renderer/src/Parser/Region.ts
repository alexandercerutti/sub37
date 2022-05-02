import { Region } from "@hsubs/server";

interface WebVTTRegion {
	id: string;
	width?: string;
	lines?: number;
	scroll?: "up" | "none";
	regionanchor?: [`${number}%`, `${number}%`];
	viewportanchor?: [`${number}%`, `${number}%`];
}

/**
 * @param rawRegionData
 */

export function parseRegion(rawRegionData: string): Region {
	const region = {} as Region;
	const attributes = rawRegionData.split(/[\n\t\s]+/);

	for (let i = 0; i < attributes.length; i++) {
		const [key, value] = attributes[i].split(":") as [keyof WebVTTRegion, string];

		if (!value || !(key in regionMappers)) {
			continue;
		}

		const mappedSubset = regionMappers[key](value);
		Object.assign(region, mappedSubset);
	}

	if (!region.id) {
		return undefined;
	}

	return region;
}

interface MappedValue {
	id: "id";
	scroll: "displayStrategy";
	lines: "lines";
	viewportanchor: "origin";
	width: "width";
}

type RegionMapper = {
	[K in keyof WebVTTRegion]: K extends keyof MappedValue
		? (value: string) => Record<MappedValue[K], Region[MappedValue[K]]>
		: never;
};

const regionMappers: RegionMapper = Object.create(null, {
	scroll: {
		value: (value: string): Pick<Region, "displayStrategy"> => ({
			displayStrategy: value === "up" ? "push" : "replace",
		}),
	},
	id: {
		value: (value: string): Pick<Region, "id"> => ({ id: value }),
	},
	lines: {
		value: (value: string): Pick<Region, "lines"> => ({ lines: parseInt(value) }),
	},
	viewportanchor: {
		value: (value: string): Pick<Region, "origin"> => {
			const origin = value.split(",") as Region["origin"];

			if (origin.length !== 2) {
				return undefined;
			}

			return { origin };
		},
	},
	width: {
		value: (value: string): Pick<Region, "width"> => ({ width: value }),
	},
});
