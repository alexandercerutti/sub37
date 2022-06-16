import type { CueNode } from "@hsubs/server";

export class Renderer extends HTMLElement {
	private mainRegion = document.createElement("div");

	/**
	 * This strategy allows people to apply a roll-up captions
	 * animation (smooth) or a pop-on captions disappearance
	 * (discrete)
	 */

	private exitTransitionMode: "discrete" | "smooth" = "discrete";

	private currentCues: Set<CueNode> = new Set<CueNode>();

	public constructor() {
		super();

		const shadowRoot = this.attachShadow({ mode: "open" });
		const style = document.createElement("style");

		style.id = "host-styles";
		style.textContent = `
:host { left: 0; right: 0; bottom: 0; top: 0; position: absolute; }
`;

		shadowRoot.appendChild(style);
		shadowRoot.appendChild(this.mainRegion);

		const exitTransitionAttribute = this.getAttribute("exit-transition");

		if (
			exitTransitionAttribute &&
			(exitTransitionAttribute === "discrete" || exitTransitionAttribute === "smooth")
		) {
			this.exitTransitionMode = exitTransitionAttribute;
		}
	}

	public setCue(cueData?: CueNode[]) {
		if (!cueData?.length) {
			cleanChildren(this.mainRegion);
			return;
		}

		const newCues = getCuesDifference(this.currentCues, new Set(cueData));

		if (!newCues.size) {
			return;
		}

		this.currentCues = new Set(cueData);

		if (this.exitTransitionMode === "discrete") {
			/**
			 * Not very optimal, we may alter the DOM every 0.25s.
			 * Probably we should keep a cache or whatever and
			 * check against it first...
			 */

			cleanChildren(this.mainRegion);

			const region = new DocumentFragment();
			const rows = new Map<string, HTMLDivElement>([]);

			for (const cueNode of newCues) {
				const rowElement = getRowById(region, rows, cueNode.id);
				const cue = Object.assign(document.createElement("span"), {
					textContent: getPresentableCueContent(cueNode),
					id: cueNode.id,
				});

				rowElement.appendChild(cue);
			}

			this.mainRegion.appendChild(region);
		} else {
			/**
			 * @TODO implement smooth transition
			 */
		}
	}
}

function cleanChildren(region: HTMLDivElement) {
	for (const child of Array.from(region.childNodes)) {
		region.removeChild(child);
	}
}

function getRowById(region: DocumentFragment, rows: Map<string, HTMLDivElement>, id: string) {
	const rowElement = rows.get(id);

	if (rowElement) {
		return rowElement;
	}

	const newRowElement = document.createElement("div");
	rows.set(id, newRowElement);
	region.appendChild(newRowElement);

	return newRowElement;
}

function getPresentableCueContent(cueNode: CueNode): string {
	/** @TODO add entities */
	return cueNode.content;
}

function getCuesDifference(current: Set<CueNode>, next: Set<CueNode>) {
	if (!current.size) {
		return next;
	}

	const difference = new Set(next);

	for (const cue of current) {
		difference.delete(cue);
	}

	return difference;
}

customElements.define("captions-presenter", Renderer);
