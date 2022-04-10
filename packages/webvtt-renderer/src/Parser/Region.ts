import { Region } from "@hsubs/server";

/**
 * 
REGION
id:fred
width:40%
lines:3
regionanchor:0%,100%
viewportanchor:10%,90%
scroll:up
 */

interface VTTRegion {
	id: string;
	width?: string;
	lines?: number;
	scroll?: "up" | "none";
	regionanchor?: [`${number}%`, `${number}%`];
	viewportanchor?: [`${number}%`, `${number}%`];
}

/**
 *
 * @param rawData
 */

export default function parseRegion(rawRegionData: string): Region {
	const data = rawRegionData.split("\n").reduce<Region>((acc, current) => {
		const [key, value] = current.split(":") as [keyof Region, string];

		const convertedValue =
			(value && (valueConverters[key] ? valueConverters[key](value) : value)) || undefined;

		if (!convertedValue) {
			return acc;
		}

		return { ...acc, [key]: convertedValue };
	}, {} as Region);

	if (!data.id) {
		return undefined;
	}

	return data;
}

const valueConverters: Partial<{ [key in keyof VTTRegion]: Function }> = {
	width: String,
	lines: parseInt,
	regionanchor: (data: string) => {
		const splitted = data.split(",");
		if (!splitted[1]) {
			return undefined;
		}

		return splitted;
	},
	viewportanchor: (data: string) => {
		const splitted = data.split(",");
		if (!splitted[1]) {
			return undefined;
		}

		return splitted;
	},
} as const;
